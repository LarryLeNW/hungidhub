import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { SearchQueryDto } from '../common/dto/search-query.dto.js';
import { paginate } from '../common/utils/pagination.js';
import { InventoryItemStatus, InventoryMovementType } from './catalog.enums.js';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { InventoryMovement } from './entities/inventory-movement.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly items: Repository<InventoryItem>,
    @InjectRepository(InventoryMovement)
    private readonly movements: Repository<InventoryMovement>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
  ) {}

  /** Admin "Nhập kho": add ready-to-deliver units for a SKU. */
  async importItems(
    variantId: number,
    payloads: string[],
    actorId: number,
    note?: string,
  ) {
    const variant = await this.variants.findOneBy({ id: variantId });
    if (!variant) {
      throw new NotFoundException(`Không tìm thấy gói sản phẩm #${variantId}`);
    }

    return this.items.manager.transaction(async (manager) => {
      await manager.save(
        payloads.map((payload) =>
          manager.create(InventoryItem, {
            variantId,
            payload,
            status: InventoryItemStatus.Available,
            importedById: actorId,
            note: note ?? null,
          }),
        ),
      );
      const available = await this.countAvailable(variantId, manager);
      await manager.save(
        manager.create(InventoryMovement, {
          variantId,
          type: InventoryMovementType.Import,
          quantity: payloads.length,
          availableAfter: available,
          actorId,
          note: note ?? null,
        }),
      );
      return { imported: payloads.length, available };
    });
  }

  /** Admin "Kho hàng" table: every SKU with its stock counters and last movement. */
  async listVariantsWithStock(query: SearchQueryDto) {
    const qb = this.variants
      .createQueryBuilder('variant')
      .innerJoin('variant.product', 'product')
      .select([
        'variant.id AS id',
        'variant.sku AS sku',
        'variant.name AS name',
        'variant.deliveryType AS deliveryType',
        'variant.isEnabled AS isEnabled',
        'product.id AS productId',
        'product.name AS productName',
        'product.lowStockThreshold AS lowStockThreshold',
      ])
      .addSelect(
        `(SELECT COUNT(*) FROM inventory_items i WHERE i.variant_id = variant.id AND i.status = 'available')`,
        'available',
      )
      .addSelect(
        `(SELECT COUNT(*) FROM inventory_items i WHERE i.variant_id = variant.id AND i.status = 'reserved')`,
        'reserved',
      )
      .addSelect(
        `(SELECT COUNT(*) FROM inventory_items i WHERE i.variant_id = variant.id AND i.status = 'delivered')`,
        'delivered',
      )
      .addSelect(
        `(SELECT MAX(m.created_at) FROM inventory_movements m WHERE m.variant_id = variant.id)`,
        'lastMovementAt',
      )
      .where('product.deletedAt IS NULL')
      .orderBy('product.name', 'ASC')
      .addOrderBy('variant.sortOrder', 'ASC');

    if (query.search) {
      qb.andWhere(
        '(variant.sku LIKE :search OR product.name LIKE :search OR variant.name LIKE :search)',
        {
          search: `%${query.search.trim()}%`,
        },
      );
    }

    const total = await qb.getCount();
    const rows = await qb.offset(query.skip).limit(query.limit).getRawMany<{
      id: number;
      sku: string;
      name: string;
      deliveryType: string;
      isEnabled: number;
      productId: number;
      productName: string;
      lowStockThreshold: number;
      available: string;
      reserved: string;
      delivered: string;
      lastMovementAt: Date | null;
    }>();

    return paginate(
      rows.map((row) => ({
        id: Number(row.id),
        sku: row.sku,
        name: row.name,
        deliveryType: row.deliveryType,
        isEnabled: Boolean(Number(row.isEnabled)),
        productId: Number(row.productId),
        productName: row.productName,
        lowStockThreshold: Number(row.lowStockThreshold),
        available: Number(row.available),
        reserved: Number(row.reserved),
        delivered: Number(row.delivered),
        lastMovementAt: row.lastMovementAt,
      })),
      total,
      query,
    );
  }

  async listItems(
    variantId: number,
    query: PaginationQueryDto,
    status?: InventoryItemStatus,
  ) {
    const [items, total] = await this.items.findAndCount({
      where: { variantId, ...(status ? { status } : {}) },
      order: { id: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  async listMovements(variantId: number, query: PaginationQueryDto) {
    const [items, total] = await this.movements.findAndCount({
      where: { variantId },
      order: { id: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  async revokeItem(itemId: number, actorId: number, note?: string) {
    const item = await this.items.findOneBy({ id: itemId });
    if (!item) {
      throw new NotFoundException(`Không tìm thấy mục kho #${itemId}`);
    }
    if (item.status !== InventoryItemStatus.Available) {
      throw new ConflictException('Chỉ thu hồi được các mục kho đang sẵn sàng');
    }
    return this.items.manager.transaction(async (manager) => {
      item.status = InventoryItemStatus.Revoked;
      item.note = note ?? item.note;
      await manager.save(item);
      await manager.save(
        manager.create(InventoryMovement, {
          variantId: item.variantId,
          type: InventoryMovementType.Revoke,
          quantity: -1,
          availableAfter: await this.countAvailable(item.variantId, manager),
          actorId,
          note: note ?? null,
        }),
      );
      return item;
    });
  }

  /**
   * Takes `quantity` available units for an order line and marks them delivered.
   * Must run inside the caller's transaction (row locks prevent double delivery).
   */
  async deliverForOrderItem(
    manager: EntityManager,
    variantId: number,
    orderItemId: number,
    quantity: number,
    actorId: number | null,
  ) {
    const units = await manager
      .createQueryBuilder(InventoryItem, 'item')
      .setLock('pessimistic_write')
      .where('item.variant_id = :variantId', { variantId })
      .andWhere('item.status = :status', {
        status: InventoryItemStatus.Available,
      })
      .orderBy('item.id', 'ASC')
      .take(quantity)
      .getMany();

    if (units.length < quantity) {
      throw new ConflictException(
        `Không đủ kho cho SKU #${variantId}: cần ${quantity}, còn ${units.length}`,
      );
    }

    const now = new Date();
    for (const unit of units) {
      unit.status = InventoryItemStatus.Delivered;
      unit.orderItemId = orderItemId;
      unit.deliveredAt = now;
    }
    await manager.save(units);
    await manager.save(
      manager.create(InventoryMovement, {
        variantId,
        type: InventoryMovementType.Deliver,
        quantity: -quantity,
        availableAfter: await this.countAvailable(variantId, manager),
        orderItemId,
        actorId,
      }),
    );
    return units;
  }

  countAvailable(
    variantId: number,
    manager: EntityManager = this.items.manager,
  ) {
    return manager.countBy(InventoryItem, {
      variantId,
      status: InventoryItemStatus.Available,
    });
  }
}
