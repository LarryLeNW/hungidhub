import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { PublishStatus } from '../content.enums.js';
import { PostCategory } from './post-category.entity.js';

/** Blog article ("Blog tin tức", guides, reviews) – WordPress `post`. */
@Entity({ name: 'posts' })
@Index(['status', 'publishedAt'])
export class Post extends TimestampedEntity {
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

  @Column({ name: 'author_id', type: 'int', nullable: true })
  authorId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author: Relation<User> | null;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

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

  @ManyToMany(() => PostCategory, (category) => category.posts)
  @JoinTable({
    name: 'post_category_links',
    joinColumn: { name: 'post_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'post_category_id', referencedColumnName: 'id' },
  })
  categories: Relation<PostCategory[]>;
}
