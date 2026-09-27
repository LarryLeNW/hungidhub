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
import { InventoryMovementType } from '../catalog.enums.js';
import { ProductVariant } from './product-variant.entity.js';

/** Append-only stock ledger per SKU (admin "Nhập kho" and every reserve/deliver/adjust). */
@Entity({ name: 'inventory_movements' })
@Index(['variantId', 'createdAt'])
export class InventoryMovement extends TimestampedEntity {
  @Column({ name: 'variant_id', type: 'int' })
  variantId: number;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: Relation<ProductVariant>;

  @Column({ type: 'enum', enum: InventoryMovementType })
  type: InventoryMovementType;

  /** Signed quantity: +N on import/release, -N on reserve/deliver/revoke. */
  @Column({ type: 'int' })
  quantity: number;

  /** Available quantity after this movement (snapshot for fast history views). */
  @Column({ name: 'available_after', type: 'int', nullable: true })
  availableAfter: number | null;

  @Column({ name: 'order_item_id', type: 'int', nullable: true })
  orderItemId: number | null;

  @ManyToOne(() => OrderItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: Relation<OrderItem> | null;

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor: Relation<User> | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;
}
