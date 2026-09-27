import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  VersionColumn,
  type Relation,
} from 'typeorm';
import { moneyColumn } from '../../common/entities/money.column.js';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { WalletTransaction } from './wallet-transaction.entity.js';

/** "Số dư AIHUB" – one wallet per user; balance changes only through `wallet_transactions`. */
@Entity({ name: 'wallets' })
export class Wallet extends TimestampedEntity {
  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column(moneyColumn({ name: 'balance' }))
  balance: number;

  @Column({ type: 'char', length: 3, default: 'VND' })
  currency: string;

  /** Optimistic lock so two concurrent debits cannot both succeed. */
  @VersionColumn()
  version: number;

  @OneToMany(() => WalletTransaction, (transaction) => transaction.wallet)
  transactions: Relation<WalletTransaction[]>;
}
