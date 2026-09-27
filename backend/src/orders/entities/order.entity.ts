import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  type Relation,
} from 'typeorm';
import { moneyColumn } from '../../common/entities/money.column.js';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { Promotion } from '../../promotions/entities/promotion.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { OrderStatus, PaymentMethod } from '../orders.enums.js';
import { OrderItem } from './order-item.entity.js';
import { Payment } from './payment.entity.js';

/**
 * Checkout result. Guest checkout is allowed, so customer contact fields are stored on the order
 * even when `user_id` is set (snapshot of what the buyer typed).
 */
@Entity({ name: 'orders' })
@Index(['status', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['customerEmail'])
export class Order extends TimestampedEntity {
  /** Public order number shown as "#AH10428". */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User> | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 120 })
  customerName: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 20 })
  customerPhone: string;

  /** Where the account/credentials are delivered. */
  @Column({ name: 'customer_email', type: 'varchar', length: 190 })
  customerEmail: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PendingPayment,
  })
  status: OrderStatus;

  @Column(moneyColumn({ name: 'subtotal' }))
  subtotal: number;

  @Column(moneyColumn({ name: 'discount_total' }))
  discountTotal: number;

  @Column(moneyColumn({ name: 'total' }))
  total: number;

  @Column({ name: 'promotion_id', type: 'int', nullable: true })
  promotionId: number | null;

  @ManyToOne(() => Promotion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'promotion_id' })
  promotion: Relation<Promotion> | null;

  /** Code snapshot so history survives promotion edits/deletes. */
  @Column({
    name: 'promotion_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  promotionCode: string | null;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt: Date | null;

  @Column({
    name: 'cancel_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  cancelReason: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: Relation<OrderItem[]>;

  @OneToMany(() => Payment, (payment) => payment.order)
  payments: Relation<Payment[]>;
}
