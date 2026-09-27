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
import { Order } from '../../orders/entities/order.entity.js';
import { User } from '../../users/entities/user.entity.js';
import {
  TransactionChannel,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../finance.enums.js';
import { FundRequest } from './fund-request.entity.js';
import { Wallet } from './wallet.entity.js';

/** Admin "Giao dịch" ledger: every credit/debit on a wallet with the resulting balance. */
@Entity({ name: 'wallet_transactions' })
@Index(['walletId', 'createdAt'])
@Index(['type', 'status', 'createdAt'])
export class WalletTransaction extends TimestampedEntity {
  /** Public reference shown as "GD-722981". */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'wallet_id', type: 'int' })
  walletId: number;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Relation<Wallet>;

  @Column({ type: 'enum', enum: WalletTransactionType })
  type: WalletTransactionType;

  @Column({
    type: 'enum',
    enum: TransactionChannel,
    default: TransactionChannel.Wallet,
  })
  channel: TransactionChannel;

  /** Signed amount: positive credits the wallet, negative debits it. */
  @Column(moneyColumn({ name: 'amount' }))
  amount: number;

  @Column(moneyColumn({ name: 'balance_after' }))
  balanceAfter: number;

  @Column({
    type: 'enum',
    enum: WalletTransactionStatus,
    default: WalletTransactionStatus.Success,
  })
  status: WalletTransactionStatus;

  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: Relation<Order> | null;

  @Column({ name: 'fund_request_id', type: 'int', nullable: true })
  fundRequestId: number | null;

  @ManyToOne(() => FundRequest, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fund_request_id' })
  fundRequest: Relation<FundRequest> | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  /** Staff member who posted a manual adjustment/refund; null for system-generated rows. */
  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: Relation<User> | null;
}
