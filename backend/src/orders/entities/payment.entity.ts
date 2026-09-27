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
import { WalletTransaction } from '../../finance/entities/wallet-transaction.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { PaymentMethod, PaymentStatus } from '../orders.enums.js';
import { Order } from './order.entity.js';

/**
 * A payment attempt for an order. Bank transfers are matched by `transfer_content`
 * (the "nội dung chuyển khoản" the customer types) and confirmed manually or by webhook.
 */
@Entity({ name: 'payments' })
@Index(['orderId'])
@Index(['status', 'createdAt'])
export class Payment extends TimestampedEntity {
  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order, (order) => order.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Relation<Order>;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column(moneyColumn({ name: 'amount' }))
  amount: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.Pending })
  status: PaymentStatus;

  /** Bank / gateway name, e.g. "ACB". */
  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string | null;

  /** Bank statement / gateway reference id. */
  @Index()
  @Column({
    name: 'transaction_ref',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  transactionRef: string | null;

  @Column({
    name: 'transfer_content',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  transferContent: string | null;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'confirmed_by_id', type: 'int', nullable: true })
  confirmedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmed_by_id' })
  confirmedBy: Relation<User> | null;

  /** Set when the order was paid from the customer's AIHUB balance. */
  @Column({ name: 'wallet_transaction_id', type: 'int', nullable: true })
  walletTransactionId: number | null;

  @ManyToOne(() => WalletTransaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'wallet_transaction_id' })
  walletTransaction: Relation<WalletTransaction> | null;

  /** Raw webhook / statement payload for reconciliation. */
  @Column({ name: 'raw_payload', type: 'json', nullable: true })
  rawPayload: Record<string, unknown> | null;
}
