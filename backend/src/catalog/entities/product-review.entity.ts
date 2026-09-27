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
import { ReviewStatus } from '../catalog.enums.js';
import { Product } from './product.entity.js';

/** Customer reviews shown in the product page "Đánh giá" section (moderated by admins). */
@Entity({ name: 'product_reviews' })
@Index(['productId', 'status', 'createdAt'])
export class ProductReview extends TimestampedEntity {
  @Column({ name: 'product_id', type: 'int' })
  productId: number;

  @ManyToOne(() => Product, (product) => product.reviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product>;

  /** Null for guest reviews (the form only asks for a display name). */
  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User> | null;

  /** Links to a purchase → "verified buyer" badge. */
  @Column({ name: 'order_item_id', type: 'int', nullable: true })
  orderItemId: number | null;

  @ManyToOne(() => OrderItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: Relation<OrderItem> | null;

  @Column({ name: 'author_name', type: 'varchar', length: 120 })
  authorName: string;

  /** 1–5. TypeORM's MySQL driver does not emit CHECK constraints, so the range is enforced in the DTO. */
  @Column({ type: 'tinyint', unsigned: true })
  rating: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.Pending })
  status: ReviewStatus;
}
