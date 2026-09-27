import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  DeliveryType,
  ProductStatus,
  StockStatus,
} from '../catalog/catalog.enums.js';
import { ProductVariant } from '../catalog/entities/product-variant.entity.js';
import { Product } from '../catalog/entities/product.entity.js';
import { InventoryService } from '../catalog/inventory.service.js';
import { assignCode, placeholderCode } from '../common/utils/codes.js';
import { paginate } from '../common/utils/pagination.js';
import {
  TransactionChannel,
  WalletTransactionType,
} from '../finance/finance.enums.js';
import { WalletsService } from '../finance/wallets.service.js';
import { PromotionScope } from '../promotions/promotions.enums.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { Setting } from '../system/entities/setting.entity.js';
import { NotificationsService } from '../system/notifications.service.js';
import {
  NotificationSection,
  NotificationTone,
} from '../system/system.enums.js';
import { User } from '../users/entities/user.entity.js';
import { CreateOrderDto, QueryOrdersDto } from './dto/order.dto.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Order } from './entities/order.entity.js';
import { Payment } from './entities/payment.entity.js';
import {
  OrderItemDeliveryStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './orders.enums.js';

export type BankInfo = {
  bankName: string;
  accountNumber: string;
  accountName: string;
};

type OrderCustomerSnapshot = {
  name: string;
  phone: string;
  email: string;
};

/** Fallback until an admin saves `payment.bank` in Settings. */
const DEFAULT_BANK_INFO: BankInfo = {
  bankName: 'VCB',
  accountNumber: '1017164832',
  accountName: 'AIHUB',
};

export type PaymentInstructions = BankInfo & {
  method: PaymentMethod;
  amount: number;
  transferContent: string;
};

const ORDER_RELATIONS = {
  items: { inventoryItems: true },
  payments: true,
} as const;

function transferContentFor(orderCode: string, userId: number | null | undefined) {
  return userId ? `AIHUB ${orderCode} KH${userId}` : `AIHUB ${orderCode}`;
}

function orderCustomerFrom(dto: CreateOrderDto, user: User | null): OrderCustomerSnapshot {
  if (user) {
    return {
      name: user.fullName.trim(),
      phone: user.phone?.trim() ?? '',
      email: user.email,
    };
  }

  if (!dto.customer) {
    throw new ForbiddenException('Đăng nhập để đặt hàng');
  }

  return {
    name: dto.customer.name.trim(),
    phone: dto.customer.phone.trim(),
    email: dto.customer.email,
  };
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    @InjectRepository(Setting) private readonly settings: Repository<Setting>,
    private readonly inventory: InventoryService,
    private readonly promotions: PromotionsService,
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------- checkout

  async create(
    dto: CreateOrderDto,
    user: User | null,
    meta: { ip?: string; userAgent?: string },
  ) {
    if (dto.paymentMethod === PaymentMethod.Wallet && !user) {
      throw new ForbiddenException('Đăng nhập để thanh toán bằng số dư AIHUB');
    }

    const customer = orderCustomerFrom(dto, user);
    const lines = await this.resolveLines(dto);
    const subtotal = lines.reduce(
      (sum, line) => sum + line.variant.price * line.quantity,
      0,
    );

    const applied = dto.promotionCode
      ? await this.promotions.validate(
          dto.promotionCode,
          subtotal,
          user?.id ?? null,
          (promotion) =>
            lines
              .filter((line) =>
                promotion.scope === PromotionScope.Products
                  ? (promotion.targetIds ?? []).includes(line.variant.productId)
                  : (line.categoryIds ?? []).some((id) =>
                      (promotion.targetIds ?? []).includes(id),
                    ),
              )
              .reduce(
                (sum, line) => sum + line.variant.price * line.quantity,
                0,
              ),
        )
      : null;

    const discountTotal = applied?.discount ?? 0;
    const total = subtotal - discountTotal;

    const order = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(Order, {
          code: placeholderCode(),
          userId: user?.id ?? null,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          note: dto.note?.trim() || null,
          paymentMethod: dto.paymentMethod,
          status: OrderStatus.PendingPayment,
          subtotal,
          discountTotal,
          total,
          promotionId: applied?.promotion.id ?? null,
          promotionCode: applied?.promotion.code ?? null,
          ipAddress: meta.ip ?? null,
          userAgent: meta.userAgent?.slice(0, 255) ?? null,
        }),
      );
      created.code = await assignCode(manager, Order, created.id, 'AH', 10000);

      await manager.save(
        lines.map((line) =>
          manager.create(OrderItem, {
            orderId: created.id,
            productId: line.variant.productId,
            variantId: line.variant.id,
            productName: line.variant.product.name,
            variantLabel: line.variant.accountType ?? line.variant.name,
            durationLabel: line.variant.duration,
            sku: line.variant.sku,
            unitPrice: line.variant.price,
            regularPrice: line.variant.regularPrice,
            quantity: line.quantity,
            lineTotal: line.variant.price * line.quantity,
            deliveryStatus: OrderItemDeliveryStatus.Pending,
          }),
        ),
      );

      if (applied) {
        await this.promotions.recordUsage(
          manager,
          applied.promotion,
          created.id,
          user?.id ?? null,
          discountTotal,
        );
      }

      if (dto.paymentMethod === PaymentMethod.Wallet && user) {
        const transaction = await this.wallets.debit(manager, user.id, total, {
          type: WalletTransactionType.Payment,
          channel: TransactionChannel.Wallet,
          orderId: created.id,
          description: `Thanh toán đơn ${created.code}`,
        });
        await manager.save(
          manager.create(Payment, {
            orderId: created.id,
            method: PaymentMethod.Wallet,
            amount: total,
            status: PaymentStatus.Paid,
            provider: 'AIHUB',
            paidAt: new Date(),
            walletTransactionId: transaction.id,
          }),
        );
        await manager.update(
          Order,
          { id: created.id },
          {
            status: OrderStatus.Processing,
            paidAt: new Date(),
          },
        );
      } else {
        await manager.save(
          manager.create(Payment, {
            orderId: created.id,
            method: dto.paymentMethod,
            amount: total,
            status: PaymentStatus.Pending,
            provider:
              dto.paymentMethod === PaymentMethod.BankTransfer ? 'ACB' : 'Zalo',
            transferContent: transferContentFor(created.code, user?.id),
          }),
        );
      }

      return manager.findOneOrFail(Order, {
        where: { id: created.id },
        relations: ORDER_RELATIONS,
      });
    });

    await this.notifications.notifyAdmins({
      title: `Có đơn hàng mới #${order.code}`,
      body: `${order.customerName} · ${order.total.toLocaleString('vi-VN')}đ · ${
        order.status === OrderStatus.Processing
          ? 'đã thanh toán bằng ví'
          : 'chờ thanh toán'
      }`,
      section: NotificationSection.Orders,
      tone: NotificationTone.Cyan,
      entityType: 'order',
      entityId: order.id,
    });

    return {
      ...order,
      paymentInstructions:
        order.status === OrderStatus.PendingPayment
          ? await this.paymentInstructions(order)
          : null,
    };
  }

  private async resolveLines(dto: CreateOrderDto) {
    const merged = new Map<number, number>();
    for (const item of dto.items) {
      merged.set(
        item.variantId,
        Math.min(99, (merged.get(item.variantId) ?? 0) + item.quantity),
      );
    }

    const variants = await this.variants.find({
      where: { id: In([...merged.keys()]) },
      relations: { product: { categories: true } },
    });
    if (variants.length !== merged.size) {
      throw new BadRequestException(
        'Một số sản phẩm trong giỏ không còn tồn tại',
      );
    }

    const lines = [];
    for (const variant of variants) {
      const quantity = merged.get(variant.id)!;
      const product: Product = variant.product;
      if (
        !variant.isEnabled ||
        product.status !== ProductStatus.Active ||
        product.deletedAt
      ) {
        throw new BadRequestException(`"${product.name}" hiện không bán`);
      }
      if (variant.stockStatus === StockStatus.OutOfStock) {
        throw new ConflictException(`"${variant.name}" đã hết hàng`);
      }
      if (variant.deliveryType === DeliveryType.Auto) {
        const available = await this.inventory.countAvailable(variant.id);
        if (available < quantity) {
          throw new ConflictException(
            `"${variant.name}" chỉ còn ${available} suất, không đủ ${quantity}`,
          );
        }
      }
      lines.push({
        variant,
        quantity,
        categoryIds: product.categories?.map((category) => category.id) ?? [],
      });
    }
    return lines;
  }

  async paymentInstructions(order: Order): Promise<PaymentInstructions> {
    const setting = await this.settings.findOneBy({ key: 'payment.bank' });
    const bank = {
      ...DEFAULT_BANK_INFO,
      ...(setting?.value as Partial<BankInfo> | undefined),
    };
    return {
      method: order.paymentMethod,
      amount: order.total,
      transferContent:
        order.payments?.find((payment) => payment.status === PaymentStatus.Pending)
          ?.transferContent ?? transferContentFor(order.code, order.userId),
      ...bank,
    };
  }

  // ------------------------------------------------------------- customer

  async lookup(code: string, email: string) {
    const order = await this.orders.findOne({
      where: { code, customerEmail: email },
      relations: ORDER_RELATIONS,
    });
    if (!order) {
      throw new NotFoundException(
        'Không tìm thấy đơn hàng với mã và email này',
      );
    }
    return this.withInstructions(order);
  }

  async listMine(userId: number, query: QueryOrdersDto) {
    const [items, total] = await this.orders.findAndCount({
      where: { userId, ...(query.status ? { status: query.status } : {}) },
      relations: { items: true },
      order: { id: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  async findMine(userId: number, code: string) {
    const order = await this.orders.findOne({
      where: { code, userId },
      relations: ORDER_RELATIONS,
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }
    return this.withInstructions(order);
  }

  private async withInstructions(order: Order) {
    return {
      ...order,
      paymentInstructions:
        order.status === OrderStatus.PendingPayment
          ? await this.paymentInstructions(order)
          : null,
    };
  }

  // ----------------------------------------------------------------- admin

  async findAdmin(query: QueryOrdersDto) {
    const qb = this.orders
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .orderBy('order.id', 'DESC');

    if (query.status) {
      qb.andWhere('order.status = :status', { status: query.status });
    }
    if (query.search) {
      const search = `%${query.search.trim().replace(/^#/, '')}%`;
      qb.andWhere(
        '(order.code LIKE :search OR order.customerName LIKE :search OR order.customerEmail LIKE :search OR order.customerPhone LIKE :search)',
        { search },
      );
    }

    const [items, total] = await qb
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();
    return paginate(items, total, query);
  }

  async findAdminById(id: number) {
    const order = await this.orders.findOne({
      where: { id },
      relations: { ...ORDER_RELATIONS, user: true },
    });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${id}`);
    }
    return order;
  }

  /** pending_payment -> processing (bank/Zalo payment seen). */
  async confirmPayment(id: number, adminId: number, transactionRef?: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, id);
      if (order.status !== OrderStatus.PendingPayment) {
        throw new ConflictException('Đơn không ở trạng thái chờ thanh toán');
      }
      const now = new Date();
      await manager.update(
        Payment,
        { orderId: id, status: PaymentStatus.Pending },
        {
          status: PaymentStatus.Paid,
          paidAt: now,
          confirmedById: adminId,
          transactionRef: transactionRef ?? null,
        },
      );
      await manager.update(
        Order,
        { id },
        { status: OrderStatus.Processing, paidAt: now },
      );
      return manager.findOneOrFail(Order, {
        where: { id },
        relations: ORDER_RELATIONS,
      });
    });
  }

  /** processing -> completed: hands out stock for auto lines, records notes for manual lines. */
  async complete(
    id: number,
    adminId: number,
    deliveryNotes: Record<string, string> = {},
  ) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, id);
      if (order.status !== OrderStatus.Processing) {
        throw new ConflictException(
          'Chỉ hoàn tất được đơn đang xử lý (đã thanh toán)',
        );
      }

      const items = await manager.find(OrderItem, {
        where: { orderId: id },
        relations: { variant: true, product: true },
      });
      const now = new Date();

      for (const item of items) {
        if (item.deliveryStatus === OrderItemDeliveryStatus.Delivered) continue;

        const deliveryType = item.variant?.deliveryType ?? DeliveryType.Manual;
        if (deliveryType === DeliveryType.Auto && item.variantId) {
          await this.inventory.deliverForOrderItem(
            manager,
            item.variantId,
            item.id,
            item.quantity,
            adminId,
          );
          const available = await this.inventory.countAvailable(
            item.variantId,
            manager,
          );
          const threshold = item.product?.lowStockThreshold ?? 0;
          if (available < threshold) {
            void this.notifications.notifyAdmins({
              title: `${item.productName} sắp hết hàng`,
              body: `SKU ${item.sku ?? item.variantId} chỉ còn ${available} suất khả dụng (ngưỡng ${threshold}).`,
              section: NotificationSection.Inventory,
              tone:
                available === 0
                  ? NotificationTone.Danger
                  : NotificationTone.Amber,
              entityType: 'product_variant',
              entityId: item.variantId,
            });
          }
        } else if (!deliveryNotes[String(item.id)]) {
          throw new BadRequestException(
            `Dòng "${item.productName}" giao thủ công: cần deliveryNotes[${item.id}]`,
          );
        }

        const warrantyDays =
          item.variant?.warrantyDays ?? item.product?.warrantyDays ?? null;
        item.deliveryStatus = OrderItemDeliveryStatus.Delivered;
        item.deliveredAt = now;
        item.deliveryNote = deliveryNotes[String(item.id)] ?? item.deliveryNote;
        item.warrantyUntil = warrantyDays
          ? new Date(now.getTime() + warrantyDays * 86_400_000)
          : null;
        await manager.save(item);

        if (item.productId) {
          await manager.increment(
            Product,
            { id: item.productId },
            'soldCount',
            item.quantity,
          );
        }
      }

      await manager.update(
        Order,
        { id },
        { status: OrderStatus.Completed, completedAt: now },
      );
      return manager.findOneOrFail(Order, {
        where: { id },
        relations: ORDER_RELATIONS,
      });
    });
  }

  async cancel(id: number, adminId: number, reason: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, id);
      if (
        order.status === OrderStatus.Completed ||
        order.status === OrderStatus.Refunded
      ) {
        throw new ConflictException(
          'Đơn đã hoàn tất/hoàn tiền, dùng hoàn tiền thay vì hủy',
        );
      }
      if (order.status === OrderStatus.Cancelled) {
        throw new ConflictException('Đơn đã hủy trước đó');
      }

      // Money already taken from the wallet goes straight back.
      if (
        order.status === OrderStatus.Processing &&
        order.paymentMethod === PaymentMethod.Wallet &&
        order.userId
      ) {
        await this.wallets.credit(manager, order.userId, order.total, {
          type: WalletTransactionType.Refund,
          orderId: order.id,
          description: `Hoàn tiền đơn ${order.code} (hủy)`,
          createdById: adminId,
        });
        await manager.update(
          Payment,
          { orderId: id },
          { status: PaymentStatus.Refunded },
        );
      } else {
        await manager.update(
          Payment,
          { orderId: id, status: PaymentStatus.Pending },
          { status: PaymentStatus.Failed },
        );
      }

      await manager.update(
        Order,
        { id },
        {
          status: OrderStatus.Cancelled,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      );
      return manager.findOneOrFail(Order, {
        where: { id },
        relations: ORDER_RELATIONS,
      });
    });
  }

  /** completed/processing -> refunded. Wallet orders are credited back; others are refunded off-platform. */
  async refund(id: number, adminId: number, reason: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, id);
      if (
        order.status !== OrderStatus.Completed &&
        order.status !== OrderStatus.Processing
      ) {
        throw new ConflictException('Chỉ hoàn tiền đơn đã thanh toán');
      }

      if (order.userId && order.paymentMethod === PaymentMethod.Wallet) {
        await this.wallets.credit(manager, order.userId, order.total, {
          type: WalletTransactionType.Refund,
          orderId: order.id,
          description: `Hoàn tiền đơn ${order.code}`,
          createdById: adminId,
        });
      }
      await manager.update(
        Payment,
        { orderId: id, status: PaymentStatus.Paid },
        { status: PaymentStatus.Refunded },
      );
      await manager.update(
        Order,
        { id },
        { status: OrderStatus.Refunded, cancelReason: reason },
      );
      return manager.findOneOrFail(Order, {
        where: { id },
        relations: ORDER_RELATIONS,
      });
    });
  }

  private async lockOrder(manager: EntityManager, id: number) {
    const order = await manager
      .createQueryBuilder(Order, 'order')
      .setLock('pessimistic_write')
      .where('order.id = :id', { id })
      .getOne();
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${id}`);
    }
    return order;
  }
}
