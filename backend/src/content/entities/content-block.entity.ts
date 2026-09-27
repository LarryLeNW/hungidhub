import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { User } from '../../users/entities/user.entity.js';
import {
  ContentBlockType,
  ContentPlacement,
  PublishStatus,
} from '../content.enums.js';

/**
 * Admin "Nội dung": hero/sale banners, system announcements and help-center articles,
 * each pinned to a placement and optionally scheduled.
 */
@Entity({ name: 'content_blocks' })
@Index(['placement', 'status', 'sortOrder'])
export class ContentBlock extends TimestampedEntity {
  /** Xóa mềm – bản ghi đã xóa bị ẩn khỏi mọi truy vấn nhưng vẫn còn trong DB. */
  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'enum', enum: ContentBlockType })
  type: ContentBlockType;

  @Column({
    type: 'enum',
    enum: ContentPlacement,
    default: ContentPlacement.Home,
  })
  placement: ContentPlacement;

  /** HTML for announcements/articles; empty for pure image banners. */
  @Column({ type: 'mediumtext', nullable: true })
  body: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  /** Optional mobile-specific banner image. */
  @Column({
    name: 'mobile_image_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  mobileImageUrl: string | null;

  @Column({ name: 'link_url', type: 'varchar', length: 500, nullable: true })
  linkUrl: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'enum', enum: PublishStatus, default: PublishStatus.Draft })
  status: PublishStatus;

  @Column({ name: 'starts_at', type: 'datetime', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'datetime', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date | null;

  /** "Người sửa" column. */
  @Column({ name: 'updated_by_id', type: 'int', nullable: true })
  updatedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by_id' })
  updatedBy: Relation<User> | null;
}
