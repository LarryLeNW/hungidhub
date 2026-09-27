import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  type Relation,
} from 'typeorm';
import { moneyColumn } from '../../common/entities/money.column.js';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { DeliveryType, StockStatus } from '../catalog.enums.js';
import { InventoryItem } from './inventory-item.entity.js';
import { Product } from './product.entity.js';

/**
 * A purchasable SKU = package ("Dùng chung - Plus") × duration ("1 tháng").
 * The storefront renders `account_type` as package buttons and `duration` as duration buttons;
 * the selected combination resolves to exactly one variant and its price.
 */
@Entity({ name: 'product_variants' })
@Index(['productId', 'sortOrder'])
export class ProductVariant extends TimestampedEntity {
  /** Xóa mềm – bản ghi đã xóa bị ẩn khỏi mọi truy vấn nhưng vẫn còn trong DB. */
  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'product_id', type: 'int' })
  productId: number;

  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product>;

  /** Admin "Kho hàng" > SKU column, e.g. "SKU-GPT-01". */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  sku: string;

  /** Display label used on cart lines and order items, e.g. "ChatGPT Plus - 1 tháng". */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Package dimension, e.g. "Dùng chung - Plus", "Chính chủ - Pro 20x". */
  @Column({
    name: 'account_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  accountType: string | null;

  /** Duration dimension label, e.g. "12 tháng", "Vĩnh viễn". */
  @Column({ type: 'varchar', length: 60, nullable: true })
  duration: string | null;

  /** Duration in days for expiry calculation; null = lifetime. */
  @Column({ name: 'duration_days', type: 'int', nullable: true })
  durationDays: number | null;

  /** Current selling price (VND). */
  @Column(moneyColumn({ name: 'price' }))
  price: number;

  /** Strike-through price; null = no discount shown. */
  @Column(moneyColumn({ name: 'regular_price', nullable: true, default: null }))
  regularPrice: number | null;

  /** Purchase (import) price for margin reports — shown as "Giá nhập" in the admin. */
  @Column(moneyColumn({ name: 'cost_price', nullable: true, default: null }))
  costPrice: number | null;

  @Column({
    name: 'stock_status',
    type: 'enum',
    enum: StockStatus,
    default: StockStatus.InStock,
  })
  stockStatus: StockStatus;

  @Column({
    name: 'delivery_type',
    type: 'enum',
    enum: DeliveryType,
    default: DeliveryType.Auto,
  })
  deliveryType: DeliveryType;

  /** Overrides the product-level warranty when set. */
  @Column({ name: 'warranty_days', type: 'int', nullable: true })
  warrantyDays: number | null;

  /** Disabled options are rendered struck-through and cannot be selected. */
  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => InventoryItem, (item) => item.variant)
  inventoryItems: Relation<InventoryItem[]>;
}
