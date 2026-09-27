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
import { SettingGroup } from '../system.enums.js';

/**
 * Key/value configuration grouped like the admin "Cài đặt" screen
 * (store info, bank accounts, notification channels, API integrations…).
 */
@Entity({ name: 'settings' })
@Index(['group'])
export class Setting extends TimestampedEntity {
  /** Dot-separated key, e.g. "store.name", "payment.bank.acb". */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'enum', enum: SettingGroup })
  group: SettingGroup;

  @Column({ type: 'json', nullable: true })
  value: unknown;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  /** Public settings are exposed to the storefront (e.g. hotline, Zalo link). */
  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ name: 'updated_by_id', type: 'int', nullable: true })
  updatedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by_id' })
  updatedBy: Relation<User> | null;
}
