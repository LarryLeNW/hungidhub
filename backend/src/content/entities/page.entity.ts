import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { PublishStatus } from '../content.enums.js';

/** Static pages: giới thiệu, hướng dẫn mua hàng, chính sách bảo mật, điều khoản… (WordPress `page`). */
@Entity({ name: 'pages' })
export class Page extends TimestampedEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 190 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  excerpt: string | null;

  @Column({ name: 'content_html', type: 'mediumtext', nullable: true })
  contentHtml: string | null;

  @Column({
    name: 'featured_image',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  featuredImage: string | null;

  @Column({ type: 'enum', enum: PublishStatus, default: PublishStatus.Draft })
  status: PublishStatus;

  /** Storefront template hint, e.g. "about", "article", "blog". */
  @Column({ type: 'varchar', length: 50, nullable: true })
  template: string | null;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'updated_by_id', type: 'int', nullable: true })
  updatedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by_id' })
  updatedBy: Relation<User> | null;

  @Column({ name: 'seo_title', type: 'varchar', length: 255, nullable: true })
  seoTitle: string | null;

  @Column({
    name: 'seo_description',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  seoDescription: string | null;

  @Index({ unique: true })
  @Column({ name: 'wp_id', type: 'int', nullable: true })
  wpId: number | null;
}
