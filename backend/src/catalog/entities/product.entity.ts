import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  type Relation,
} from 'typeorm';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { ProductStatus } from '../catalog.enums.js';
import { Category } from './category.entity.js';
import { ProductImage } from './product-image.entity.js';
import { ProductReview } from './product-review.entity.js';
import { ProductVariant } from './product-variant.entity.js';

const decimalToNumber = {
  to: (value?: number | null) => value,
  from: (value?: string | number | null) =>
    value === null || value === undefined ? value : Number(value),
};

/**
 * A sellable listing (e.g. "Tài khoản ChatGPT Plus & Pro"). Prices/stock live on `product_variants`;
 * `rating_average`, `review_count`, `sold_count` are denormalised counters for listing pages.
 */
@Entity({ name: 'products' })
@Index(['status', 'sortOrder'])
export class Product extends TimestampedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 190 })
  slug: string;

  /** Card excerpt on listing pages. */
  @Column({ name: 'short_description', type: 'text', nullable: true })
  shortDescription: string | null;

  /** Full description rendered on the product page. */
  @Column({ name: 'content_html', type: 'mediumtext', nullable: true })
  contentHtml: string | null;

  @Column({
    name: 'featured_image',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  featuredImage: string | null;

  /** Badge labels rendered on the card, e.g. ["Sale", "Hot"]. */
  @Column({ type: 'json', nullable: true })
  badges: string[] | null;

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.Draft })
  status: ProductStatus;

  @Column({
    name: 'rating_average',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0,
    transformer: decimalToNumber,
  })
  ratingAverage: number;

  @Column({ name: 'review_count', type: 'int', default: 0 })
  reviewCount: number;

  @Column({ name: 'sold_count', type: 'int', default: 0 })
  soldCount: number;

  /** Below this available quantity the admin shows "Sắp hết" and raises a stock notification. */
  @Column({ name: 'low_stock_threshold', type: 'int', default: 10 })
  lowStockThreshold: number;

  /** Default warranty applied to order items (variants may override). */
  @Column({ name: 'warranty_days', type: 'int', nullable: true })
  warrantyDays: number | null;

  /** Copy shown near the buy button, e.g. "Giao tự động 5–15 phút". */
  @Column({
    name: 'delivery_time_text',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  deliveryTimeText: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'seo_title', type: 'varchar', length: 255, nullable: true })
  seoTitle: string | null;

  @Column({
    name: 'seo_description',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  seoDescription: string | null;

  /** Source id from the WordPress sync. */
  @Index({ unique: true })
  @Column({ name: 'wp_id', type: 'int', nullable: true })
  wpId: number | null;

  @ManyToMany(() => Category, (category) => category.products)
  @JoinTable({
    name: 'product_categories',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories: Relation<Category[]>;

  @OneToMany(() => ProductImage, (image) => image.product)
  images: Relation<ProductImage[]>;

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: Relation<ProductVariant[]>;

  @OneToMany(() => ProductReview, (review) => review.product)
  reviews: Relation<ProductReview[]>;

  /** Soft delete keeps order history pointing at a real row. */
  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
