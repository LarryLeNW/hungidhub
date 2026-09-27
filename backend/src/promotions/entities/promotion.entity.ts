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
import { User } from '../../users/entities/user.entity.js';
import {
  PromotionScope,
  PromotionStatus,
  PromotionType,
} from '../promotions.enums.js';
import { PromotionUsage } from './promotion-usage.entity.js';

/** Admin "Khuyến mãi": a campaign with a redeemable code, usage caps and a schedule. */
@Entity({ name: 'promotions' })
@Index(['status', 'endsAt'])
export class Promotion extends TimestampedEntity {
  /** Xóa mềm – bản ghi đã xóa bị ẩn khỏi mọi truy vấn nhưng vẫn còn trong DB. */
  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;

  /** Campaign name, e.g. "Khách hàng mới". */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Redeem code, stored upper-case, e.g. "AIHUB10". */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'enum', enum: PromotionType, default: PromotionType.Percent })
  type: PromotionType;

  /** Percent (0–100) for percent types, VND for fixed. */
  @Column({ type: 'int' })
  value: number;

  /** Cap for percent discounts; null = uncapped. */
  @Column(moneyColumn({ name: 'max_discount', nullable: true, default: null }))
  maxDiscount: number | null;

  @Column(moneyColumn({ name: 'min_order_total' }))
  minOrderTotal: number;

  /** "Lượt dùng" denominator; null = unlimited. */
  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usageLimit: number | null;

  /** "Lượt dùng" numerator (denormalised from `promotion_usages`). */
  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount: number;

  @Column({ name: 'per_user_limit', type: 'int', nullable: true })
  perUserLimit: number | null;

  @Column({ type: 'enum', enum: PromotionScope, default: PromotionScope.All })
  scope: PromotionScope;

  /** Category or product ids when `scope` is not `all`. */
  @Column({ name: 'target_ids', type: 'json', nullable: true })
  targetIds: number[] | null;

  @Column({ name: 'starts_at', type: 'datetime', nullable: true })
  startsAt: Date | null;

  /** "Kết thúc" column. */
  @Column({ name: 'ends_at', type: 'datetime', nullable: true })
  endsAt: Date | null;

  @Column({
    type: 'enum',
    enum: PromotionStatus,
    default: PromotionStatus.Scheduled,
  })
  status: PromotionStatus;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: Relation<User> | null;

  @OneToMany(() => PromotionUsage, (usage) => usage.promotion)
  usages: Relation<PromotionUsage[]>;
}
