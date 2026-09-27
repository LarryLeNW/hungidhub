import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  type Relation,
} from 'typeorm';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { Product } from './product.entity.js';

/**
 * Product category tree (storefront mega-menu + admin "Danh mục").
 * Mirrors WooCommerce `product_cat` incl. nested paths like "ung-dung-phan-mem-khac/cong-cu-ai".
 */
@Entity({ name: 'categories' })
@Index(['parentId', 'sortOrder'])
export class Category extends TimestampedEntity {
  /** Xóa mềm – bản ghi đã xóa bị ẩn khỏi mọi truy vấn nhưng vẫn còn trong DB. */
  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 190 })
  slug: string;

  /** Full nested path used in URLs (unique across the tree). */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  path: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Rich landing content rendered on the category page. */
  @Column({ name: 'content_html', type: 'mediumtext', nullable: true })
  contentHtml: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  /** lucide-react icon name shown in the header category menu (e.g. "Bot"). */
  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId: number | null;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Relation<Category> | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Relation<Category[]>;

  /** Admin "Thứ tự" column. */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /** Admin "Trạng thái": Hiển thị / Ẩn. */
  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible: boolean;

  @Column({ name: 'seo_title', type: 'varchar', length: 255, nullable: true })
  seoTitle: string | null;

  @Column({
    name: 'seo_description',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  seoDescription: string | null;

  /** Source id from the WordPress sync (`scripts/sync-wp-content.mjs`). */
  @Index({ unique: true })
  @Column({ name: 'wp_id', type: 'int', nullable: true })
  wpId: number | null;

  @ManyToMany(() => Product, (product) => product.categories)
  products: Relation<Product[]>;
}
