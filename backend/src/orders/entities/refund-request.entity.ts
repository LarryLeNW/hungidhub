import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { moneyColumn } from '../../common/entities/money.column.js';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { RefundMethod, RefundRequestStatus } from '../orders.enums.js';
import { Order } from './order.entity.js';

@Entity({ name: 'refund_requests' })
@Index(['status', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['orderId'])
export class RefundRequest extends TimestampedEntity {
  /** Mã yêu cầu, ví dụ: "HT-10428" */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 25 })
  code: string;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Relation<Order>;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User> | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 120 })
  customerName: string;

  @Column({ name: 'customer_email', type: 'varchar', length: 190 })
  customerEmail: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 20, nullable: true })
  customerPhone: string | null;

  @Column(moneyColumn({ name: 'amount' }))
  amount: number;

  @Column({
    type: 'enum',
    enum: RefundRequestStatus,
    default: RefundRequestStatus.Pending,
  })
  status: RefundRequestStatus;

  @Column({
    name: 'refund_method',
    type: 'enum',
    enum: RefundMethod,
    default: RefundMethod.Wallet,
  })
  refundMethod: RefundMethod;

  @Column({ type: 'varchar', length: 150 })
  reason: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName: string | null;

  @Column({ name: 'bank_account_number', type: 'varchar', length: 50, nullable: true })
  bankAccountNumber: string | null;

  @Column({ name: 'bank_account_name', type: 'varchar', length: 120, nullable: true })
  bankAccountName: string | null;

  @Column({ name: 'proof_image_url', type: 'varchar', length: 500, nullable: true })
  proofImageUrl: string | null;

  @Column({ name: 'reviewed_by_id', type: 'int', nullable: true })
  reviewedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy: Relation<User> | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'admin_note', type: 'varchar', length: 255, nullable: true })
  adminNote: string | null;

  @Column({ name: 'reject_reason', type: 'varchar', length: 255, nullable: true })
  rejectReason: string | null;
}
