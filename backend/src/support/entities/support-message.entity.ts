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
import { TicketAuthorType } from '../support.enums.js';
import { SupportTicket } from './support-ticket.entity.js';

/** Conversation thread on a support ticket. */
@Entity({ name: 'support_messages' })
@Index(['ticketId', 'createdAt'])
export class SupportMessage extends TimestampedEntity {
  @Column({ name: 'ticket_id', type: 'int' })
  ticketId: number;

  @ManyToOne(() => SupportTicket, (ticket) => ticket.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Relation<SupportTicket>;

  @Column({ name: 'author_id', type: 'int', nullable: true })
  authorId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author: Relation<User> | null;

  @Column({ name: 'author_type', type: 'enum', enum: TicketAuthorType })
  authorType: TicketAuthorType;

  @Column({ type: 'text' })
  body: string;

  /** Uploaded screenshots etc.: [{ url, name, size }]. */
  @Column({ type: 'json', nullable: true })
  attachments: { url: string; name?: string; size?: number }[] | null;

  /** Internal staff notes are hidden from the customer. */
  @Column({ name: 'is_internal', type: 'boolean', default: false })
  isInternal: boolean;
}
