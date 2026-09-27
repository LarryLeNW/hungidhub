import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  type Relation,
} from 'typeorm';
import { InventoryItem } from '../../catalog/entities/inventory-item.entity.js';
import { ProductVariant } from '../../catalog/entities/product-variant.entity.js';
import { Product } from '../../catalog/entities/product.entity.js';
import { moneyColumn } from '../../common/entities/money.column.js';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { OrderItemDeliveryStatus } from '../orders.enums.js';
import { Order } from './order.entity.js';

/**
 * One cart line frozen at checkout: names/prices are snapshots so later catalog edits
 * do not rewrite history. Fulfilment state lives here (per line, not per order).
 */
@Entity({ name: 'order_items' })
@Index(['orderId'])
@Index(['variantId', 'createdAt'])
export class OrderItem extends TimestampedEntity {
  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Relation<Order>;

  @Column({ name: 'product_id', type: 'int', nullable: true })
  productId: number | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product> | null;

  @Column({ name: 'variant_id', type: 'int', nullable: true })
  variantId: number | null;

  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'variant_id' })
  variant: Relation<ProductVariant> | null;

  @Column({ name: 'product_name', type: 'varchar', length: 255 })
  productName: string;

  /** Cart line "variantLabel", e.g. "Dùng chung - Plus". */
  @Column({
    name: 'variant_label',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  variantLabel: string | null;

  /** Cart line "durationLabel", e.g. "1 tháng". */
  @Column({
    name: 'duration_label',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  durationLabel: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sku: string | null;

  @Column(moneyColumn({ name: 'unit_price' }))
  unitPrice: number;

  @Column(moneyColumn({ name: 'regular_price', nullable: true, default: null }))
  regularPrice: number | null;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column(moneyColumn({ name: 'line_total' }))
  lineTotal: number;

  @Column({
    name: 'delivery_status',
    type: 'enum',
    enum: OrderItemDeliveryStatus,
    default: OrderItemDeliveryStatus.Pending,
  })
  deliveryStatus: OrderItemDeliveryStatus;

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  deliveredAt: Date | null;

  /** Free-form delivery info for manual fulfilment (activation steps, upgraded email…). */
  @Column({ name: 'delivery_note', type: 'text', nullable: true })
  deliveryNote: string | null;

  /** Computed at delivery from the variant/product warranty days. */
  @Column({ name: 'warranty_until', type: 'datetime', nullable: true })
  warrantyUntil: Date | null;

  @OneToMany(() => InventoryItem, (item) => item.orderItem)
  inventoryItems: Relation<InventoryItem[]>;
}
