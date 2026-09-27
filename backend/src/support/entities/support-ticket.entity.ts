import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  type Relation,
} from 'typeorm';
import { TimestampedEntity } from '../../common/entities/timestamped.entity.js';
import { Order } from '../../orders/entities/order.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { TicketPriority, TicketStatus } from '../support.enums.js';
import { SupportMessage } from './support-message.entity.js';

/** Admin "Trung tâm hỗ trợ": complaints, exchange requests and disputes, optionally tied to an order. */
@Entity({ name: 'support_tickets' })
@Index(['status', 'priority', 'updatedAt'])
@Index(['userId', 'createdAt'])
export class SupportTicket extends TimestampedEntity {
  /** Public reference shown as "TK-9201". */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User> | null;

  /** Contact snapshot (guests can open tickets from the storefront). */
  @Column({ name: 'customer_name', type: 'varchar', length: 120 })
  customerName: string;

  @Column({
    name: 'customer_email',
    type: 'varchar',
    length: 190,
    nullable: true,
  })
  customerEmail: string | null;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: Relation<Order> | null;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.Medium,
  })
  priority: TicketPriority;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.New })
  status: TicketStatus;

  @Column({ name: 'assignee_id', type: 'int', nullable: true })
  assigneeId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_id' })
  assignee: Relation<User> | null;

  @Column({ name: 'last_message_at', type: 'datetime', nullable: true })
  lastMessageAt: Date | null;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt: Date | null;

  @OneToMany(() => SupportMessage, (message) => message.ticket)
  messages: Relation<SupportMessage[]>;
}
