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
import { FundRequestStatus, FundRequestType } from '../finance.enums.js';

/** Admin "Nạp & rút tiền": a customer request that staff approve before the wallet moves. */
@Entity({ name: 'fund_requests' })
@Index(['status', 'createdAt'])
@Index(['userId', 'createdAt'])
export class FundRequest extends TimestampedEntity {
  /** Public reference shown as "YC-3912". */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ type: 'enum', enum: FundRequestType })
  type: FundRequestType;

  @Column(moneyColumn({ name: 'amount' }))
  amount: number;

  @Column({
    type: 'enum',
    enum: FundRequestStatus,
    default: FundRequestStatus.Pending,
  })
  status: FundRequestStatus;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName: string | null;

  @Column({
    name: 'bank_account_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  bankAccountNumber: string | null;

  @Column({
    name: 'bank_account_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  bankAccountName: string | null;

  /** Deposit: the transfer memo the customer must use; withdrawal: memo used on the outgoing transfer. */
  @Column({
    name: 'transfer_content',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  transferContent: string | null;

  /** Screenshot / receipt uploaded by the requester. */
  @Column({
    name: 'proof_image_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  proofImageUrl: string | null;

  @Column({ name: 'reviewed_by_id', type: 'int', nullable: true })
  reviewedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy: Relation<User> | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @Column({
    name: 'reject_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  rejectReason: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;
}
