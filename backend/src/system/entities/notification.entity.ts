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
import { NotificationSection, NotificationTone } from '../system.enums.js';

/** Admin bell notifications ("Có đơn hàng mới #AH10429", "Gemini Pro 5TB sắp hết hàng"…). */
@Entity({ name: 'notifications' })
@Index(['recipientId', 'readAt', 'createdAt'])
export class Notification extends TimestampedEntity {
  /** Null = broadcast to every admin. */
  @Column({ name: 'recipient_id', type: 'int', nullable: true })
  recipientId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient: Relation<User> | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  body: string | null;

  /** Admin section the notification deep-links to. */
  @Column({ type: 'enum', enum: NotificationSection, nullable: true })
  section: NotificationSection | null;

  @Column({
    type: 'enum',
    enum: NotificationTone,
    default: NotificationTone.Blue,
  })
  tone: NotificationTone;

  @Column({ name: 'link_url', type: 'varchar', length: 500, nullable: true })
  linkUrl: string | null;

  /** Source record, e.g. ("order", 10429). */
  @Column({ name: 'entity_type', type: 'varchar', length: 50, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'int', nullable: true })
  entityId: number | null;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt: Date | null;
}
