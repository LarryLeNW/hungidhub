import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
  type Relation,
} from 'typeorm';
import { moneyColumn } from '../../common/entities/money.column.js';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { Order } from '../../orders/entities/order.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Promotion } from './promotion.entity.js';

/** One redemption of a promotion on an order (enforces per-user and total limits). */
@Entity({ name: 'promotion_usages' })
@Unique(['promotionId', 'orderId'])
@Index(['promotionId', 'userId'])
export class PromotionUsage extends TimestampedEntity {
  @Column({ name: 'promotion_id', type: 'int' })
  promotionId: number;

  @ManyToOne(() => Promotion, (promotion) => promotion.usages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'promotion_id' })
  promotion: Relation<Promotion>;

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

  @Column(moneyColumn({ name: 'discount_amount' }))
  discountAmount: number;
}
