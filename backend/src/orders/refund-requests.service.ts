import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { WalletsService } from '../finance/wallets.service.js';
import { WalletTransactionType } from '../finance/finance.enums.js';
import { User } from '../users/entities/user.entity.js';
import {
  CreateRefundRequestDto,
  QueryRefundRequestsDto,
} from './dto/refund-request.dto.js';
import { Order } from './entities/order.entity.js';
import { Payment } from './entities/payment.entity.js';
import { RefundRequest } from './entities/refund-request.entity.js';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundMethod,
  RefundRequestStatus,
} from './orders.enums.js';

@Injectable()
export class RefundRequestsService {
  constructor(
    @InjectRepository(RefundRequest)
    private readonly refundRequests: Repository<RefundRequest>,
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly wallets: WalletsService,
  ) {}

  async create(dto: CreateRefundRequestDto, user?: User | null) {
    const rawCode = dto.orderCode.toUpperCase().replace(/^#/, '').trim();
    const order = await this.orders.findOne({
      where: { code: rawCode },
      relations: { items: true, payments: true },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${rawCode}`);
    }

    // Kiểm tra quyền sở hữu đơn hàng
    if (user) {
      if (order.userId && order.userId !== user.id) {
        throw new ForbiddenException('Bạn không sở hữu đơn hàng này');
      }
    } else {
      if (!dto.customerEmail) {
        throw new BadRequestException('Vui lòng nhập email đặt hàng để xác thực');
      }
      if (
        dto.customerEmail.toLowerCase().trim() !==
        order.customerEmail.toLowerCase().trim()
      ) {
        throw new BadRequestException('Email không khớp với thông tin đơn hàng');
      }
    }

    // Kiểm tra trạng thái đơn hàng
    if (order.status === OrderStatus.Refunded) {
      throw new ConflictException('Đơn hàng này đã được hoàn tiền trước đó');
    }
    if (
      order.status !== OrderStatus.Completed &&
      order.status !== OrderStatus.Processing
    ) {
      throw new ConflictException(
        'Chỉ có thể yêu cầu hoàn tiền cho đơn hàng đã thanh toán (Đang xử lý hoặc Hoàn tất)',
      );
    }

    // Kiểm tra xem đơn hàng đã có yêu cầu hoàn tiền đang chờ hay chưa
    const existing = await this.refundRequests.findOne({
      where: {
        orderId: order.id,
        status: In([
          RefundRequestStatus.Pending,
          RefundRequestStatus.Processing,
        ]),
      },
    });

    if (existing) {
      throw new ConflictException(
        `Đơn hàng #${order.code} đã có yêu cầu hoàn tiền (${existing.code}) đang được xử lý`,
      );
    }

    // Tạo mã yêu cầu duy nhất
    let code = `HT-${order.code}`;
    let counter = 1;
    while (await this.refundRequests.existsBy({ code })) {
      code = `HT-${order.code}-${counter}`;
      counter++;
    }

    const defaultRefundMethod =
      order.paymentMethod === PaymentMethod.Wallet
        ? RefundMethod.Wallet
        : RefundMethod.BankTransfer;

    const request = this.refundRequests.create({
      code,
      orderId: order.id,
      userId: user?.id ?? order.userId ?? null,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      amount: order.total,
      status: RefundRequestStatus.Pending,
      refundMethod: dto.refundMethod ?? defaultRefundMethod,
      reason: dto.reason,
      description: dto.description ?? null,
      bankName: dto.bankName ?? null,
      bankAccountNumber: dto.bankAccountNumber ?? null,
      bankAccountName: dto.bankAccountName ?? null,
      proofImageUrl: dto.proofImageUrl ?? null,
    });

    return this.refundRequests.save(request);
  }

  async listMine(userId: number, query: QueryRefundRequestsDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(50, query.limit ?? 10));

    const qb = this.refundRequests
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.order', 'order')
      .leftJoinAndSelect('order.items', 'items')
      .where('req.userId = :userId', { userId })
      .orderBy('req.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('req.status = :status', { status: query.status });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findMine(userId: number, id: number) {
    const request = await this.refundRequests.findOne({
      where: { id, userId },
      relations: { order: { items: true } },
    });

    if (!request) {
      throw new NotFoundException(`Không tìm thấy yêu cầu hoàn tiền #${id}`);
    }

    return request;
  }

  async cancelMine(userId: number, id: number) {
    const request = await this.findMine(userId, id);

    if (request.status !== RefundRequestStatus.Pending) {
      throw new ConflictException('Chỉ có thể hủy yêu cầu hoàn tiền khi đang chờ duyệt');
    }

    request.status = RefundRequestStatus.Cancelled;
    return this.refundRequests.save(request);
  }

  async lookup(code: string, email: string) {
    const cleanCode = code.toUpperCase().replace(/^#/, '').trim();
    const cleanEmail = email.toLowerCase().trim();

    const request = await this.refundRequests
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.order', 'order')
      .leftJoinAndSelect('order.items', 'items')
      .where('(req.code = :cleanCode OR order.code = :cleanCode)', { cleanCode })
      .andWhere('LOWER(req.customerEmail) = :cleanEmail', { cleanEmail })
      .orderBy('req.createdAt', 'DESC')
      .getOne();

    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu hoàn tiền phù hợp');
    }

    return request;
  }

  async findAdmin(query: QueryRefundRequestsDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 10));

    const qb = this.refundRequests
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.order', 'order')
      .leftJoinAndSelect('req.user', 'user')
      .leftJoinAndSelect('req.reviewedBy', 'reviewedBy')
      .orderBy('req.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('req.status = :status', { status: query.status });
    }

    if (query.search) {
      const s = `%${query.search.trim()}%`;
      qb.andWhere(
        '(req.code LIKE :s OR order.code LIKE :s OR req.customerEmail LIKE :s OR req.customerName LIKE :s OR req.customerPhone LIKE :s)',
        { s },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findByIdAdmin(id: number) {
    const request = await this.refundRequests.findOne({
      where: { id },
      relations: {
        order: { items: true, payments: true },
        user: true,
        reviewedBy: true,
      },
    });

    if (!request) {
      throw new NotFoundException(`Không tìm thấy yêu cầu hoàn tiền #${id}`);
    }

    return request;
  }

  async approve(id: number, adminId: number, note?: string) {
    return this.dataSource.transaction(async (manager) => {
      const req = await manager.findOne(RefundRequest, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        relations: { order: true },
      });

      if (!req) {
        throw new NotFoundException(`Không tìm thấy yêu cầu hoàn tiền #${id}`);
      }

      if (
        req.status !== RefundRequestStatus.Pending &&
        req.status !== RefundRequestStatus.Processing
      ) {
        throw new ConflictException('Yêu cầu này đã được xử lý hoặc đã bị hủy');
      }

      const order = await manager.findOne(Order, {
        where: { id: req.orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng của yêu cầu này');
      }

      // Nếu chọn hoàn vào ví và tài khoản có liên kết userId -> cộng tiền vào ví
      if (req.refundMethod === RefundMethod.Wallet && order.userId) {
        await this.wallets.credit(manager, order.userId, req.amount, {
          type: WalletTransactionType.Refund,
          orderId: order.id,
          description: `Hoàn tiền đơn #${order.code} theo yêu cầu ${req.code}`,
          createdById: adminId,
        });
      }

      // Cập nhật trạng thái Payment sang Refunded
      await manager.update(
        Payment,
        { orderId: order.id },
        { status: PaymentStatus.Refunded },
      );

      // Cập nhật trạng thái Order sang Refunded
      await manager.update(
        Order,
        { id: order.id },
        {
          status: OrderStatus.Refunded,
          cancelReason: `Hoàn tiền theo yêu cầu ${req.code}: ${req.reason}`,
        },
      );

      // Cập nhật RefundRequest
      req.status = RefundRequestStatus.Completed;
      req.reviewedById = adminId;
      req.reviewedAt = new Date();
      req.adminNote = note ?? 'Quản trị viên đã duyệt hoàn tiền';

      return manager.save(RefundRequest, req);
    });
  }

  async reject(id: number, adminId: number, reason: string) {
    const req = await this.refundRequests.findOne({
      where: { id },
    });

    if (!req) {
      throw new NotFoundException(`Không tìm thấy yêu cầu hoàn tiền #${id}`);
    }

    if (
      req.status !== RefundRequestStatus.Pending &&
      req.status !== RefundRequestStatus.Processing
    ) {
      throw new ConflictException('Yêu cầu này đã được xử lý hoặc đã bị hủy');
    }

    req.status = RefundRequestStatus.Rejected;
    req.reviewedById = adminId;
    req.reviewedAt = new Date();
    req.rejectReason = reason;

    return this.refundRequests.save(req);
  }
}
