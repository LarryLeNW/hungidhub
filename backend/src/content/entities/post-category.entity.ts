import { Column, Entity, Index, ManyToMany, type Relation } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { Post } from './post.entity.js';

/** Blog taxonomy (WordPress `category`). */
@Entity({ name: 'post_categories' })
export class PostCategory extends TimestampedEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 190 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Index({ unique: true })
  @Column({ name: 'wp_id', type: 'int', nullable: true })
  wpId: number | null;

  @ManyToMany(() => Post, (post) => post.categories)
  posts: Relation<Post[]>;
}
