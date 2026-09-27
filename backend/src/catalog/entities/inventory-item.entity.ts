import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { OrderItem } from '../../orders/entities/order-item.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { InventoryItemStatus } from '../catalog.enums.js';
import { ProductVariant } from './product-variant.entity.js';

/**
 * One deliverable unit of digital stock (an account, license key, voucher…).
 * Admin "Kho hàng": available = COUNT(status='available'), reserved = COUNT(status='reserved').
 */
@Entity({ name: 'inventory_items' })
@Index(['variantId', 'status'])
export class InventoryItem extends TimestampedEntity {
  @Column({ name: 'variant_id', type: 'int' })
  variantId: number;

  @ManyToOne(() => ProductVariant, (variant) => variant.inventoryItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: Relation<ProductVariant>;

  /** Credentials handed to the buyer. Encrypt at the application layer before persisting. */
  @Column({ type: 'text' })
  payload: string;

  @Column({
    type: 'enum',
    enum: InventoryItemStatus,
    default: InventoryItemStatus.Available,
  })
  status: InventoryItemStatus;

  /** Set once the unit is reserved/delivered for an order line. */
  @Column({ name: 'order_item_id', type: 'int', nullable: true })
  orderItemId: number | null;

  @ManyToOne(() => OrderItem, (item) => item.inventoryItems, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: Relation<OrderItem> | null;

  @Column({ name: 'reserved_at', type: 'datetime', nullable: true })
  reservedAt: Date | null;

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  deliveredAt: Date | null;

  /** When the underlying account/key stops working (drives warranty + expiry reminders). */
  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'imported_by_id', type: 'int', nullable: true })
  importedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'imported_by_id' })
  importedBy: Relation<User> | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;
}
