import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { Product } from './product.entity.js';

/** Gallery images for a product (the first by `sort_order` is the thumbnail fallback). */
@Entity({ name: 'product_images' })
@Index(['productId', 'sortOrder'])
export class ProductImage extends TimestampedEntity {
  @Column({ name: 'product_id', type: 'int' })
  productId: number;

  @ManyToOne(() => Product, (product) => product.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product>;

  @Column({ type: 'varchar', length: 500 })
  src: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alt: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
