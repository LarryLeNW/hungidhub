import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { paginate } from '../common/utils/pagination.js';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto.js';
import { PromotionUsage } from './entities/promotion-usage.entity.js';
import { Promotion } from './entities/promotion.entity.js';
import {
  PromotionScope,
  PromotionStatus,
  PromotionType,
} from './promotions.enums.js';

export type AppliedPromotion = { promotion: Promotion; discount: number };

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotions: Repository<Promotion>,
    @InjectRepository(PromotionUsage)
    private readonly usages: Repository<PromotionUsage>,
  ) {}

  /**
   * Checks a code against schedule, caps and minimum order and returns the discount in VND.
   * `eligibleSubtotal` is the part of the order the promotion may apply to.
   */
  async validate(
    code: string,
    subtotal: number,
    userId: number | null,
    eligibleSubtotalByScope?: (promotion: Promotion) => number,
  ): Promise<AppliedPromotion> {
    const promotion = await this.promotions.findOneBy({
      code: code.trim().toUpperCase(),
    });
    if (!promotion) {
      throw new BadRequestException('Mã khuyến mãi không tồn tại');
    }

    const now = new Date();
    if (promotion.status !== PromotionStatus.Active) {
      throw new BadRequestException(
        'Mã khuyến mãi chưa kích hoạt hoặc đã kết thúc',
      );
    }
    if (promotion.startsAt && promotion.startsAt > now) {
      throw new BadRequestException('Mã khuyến mãi chưa bắt đầu');
    }
    if (promotion.endsAt && promotion.endsAt < now) {
      throw new BadRequestException('Mã khuyến mãi đã hết hạn');
    }
    if (
      promotion.usageLimit !== null &&
      promotion.usageCount >= promotion.usageLimit
    ) {
      throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
    }
    if (promotion.perUserLimit !== null && userId) {
      const used = await this.usages.countBy({
        promotionId: promotion.id,
        userId,
      });
      if (used >= promotion.perUserLimit) {
        throw new BadRequestException('Bạn đã dùng hết lượt của mã này');
      }
    }
    if (subtotal < promotion.minOrderTotal) {
      throw new BadRequestException(
        `Đơn hàng tối thiểu ${promotion.minOrderTotal.toLocaleString('vi-VN')}đ để dùng mã này`,
      );
    }

    const eligible =
      promotion.scope === PromotionScope.All || !eligibleSubtotalByScope
        ? subtotal
        : eligibleSubtotalByScope(promotion);
    if (eligible <= 0) {
      throw new BadRequestException(
        'Mã khuyến mãi không áp dụng cho sản phẩm trong giỏ',
      );
    }

    let discount =
      promotion.type === PromotionType.Percent
        ? Math.floor((eligible * promotion.value) / 100)
        : Math.min(promotion.value, eligible);
    if (promotion.maxDiscount !== null) {
      discount = Math.min(discount, promotion.maxDiscount);
    }

    return { promotion, discount: Math.max(0, Math.min(discount, subtotal)) };
  }

  /** Must run inside the order transaction. */
  async recordUsage(
    manager: EntityManager,
    promotion: Promotion,
    orderId: number,
    userId: number | null,
    discount: number,
  ) {
    await manager.save(
      manager.create(PromotionUsage, {
        promotionId: promotion.id,
        orderId,
        userId,
        discountAmount: discount,
      }),
    );
    await manager.increment(Promotion, { id: promotion.id }, 'usageCount', 1);
  }

  // -------------------------------------------------------------------- admin

  async findAll(query: PaginationQueryDto) {
    const [items, total] = await this.promotions.findAndCount({
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  async findById(id: number) {
    const promotion = await this.promotions.findOneBy({ id });
    if (!promotion) {
      throw new NotFoundException(`Không tìm thấy khuyến mãi #${id}`);
    }
    return promotion;
  }

  async create(dto: CreatePromotionDto, createdById: number) {
    if (await this.promotions.exists({ where: { code: dto.code }, withDeleted: true })) {
      throw new ConflictException(`Mã "${dto.code}" đã tồn tại`);
    }
    if (dto.type === PromotionType.Percent && dto.value > 100) {
      throw new BadRequestException('Giá trị phần trăm phải trong khoảng 0-100');
    }
    return this.promotions.save(
      this.promotions.create({
        ...dto,
        maxDiscount: dto.maxDiscount ?? null,
        minOrderTotal: dto.minOrderTotal ?? 0,
        usageLimit: dto.usageLimit ?? null,
        perUserLimit: dto.perUserLimit ?? null,
        scope: dto.scope ?? PromotionScope.All,
        targetIds: dto.targetIds ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        status: dto.status ?? PromotionStatus.Active,
        description: dto.description ?? null,
        createdById,
      }),
    );
  }

  async update(id: number, dto: UpdatePromotionDto) {
    const promotion = await this.findById(id);
    if (dto.code && dto.code !== promotion.code) {
      if (await this.promotions.exists({ where: { code: dto.code }, withDeleted: true })) {
        throw new ConflictException(`Mã "${dto.code}" đã tồn tại`);
      }
    }
    const { startsAt, endsAt, ...rest } = dto;
    Object.assign(promotion, rest, {
      ...(startsAt !== undefined
        ? { startsAt: startsAt ? new Date(startsAt) : null }
        : {}),
      ...(endsAt !== undefined
        ? { endsAt: endsAt ? new Date(endsAt) : null }
        : {}),
    });
    return this.promotions.save(promotion);
  }

  async remove(id: number) {
    const promotion = await this.findById(id);
    if (promotion.usageCount > 0) {
      promotion.status = PromotionStatus.Ended;
      await this.promotions.save(promotion);
      return;
    }
    await this.promotions.softDelete({ id });
  }
}
