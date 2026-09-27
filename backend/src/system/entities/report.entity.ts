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
import { ReportFormat, ReportStatus } from '../system.enums.js';

/** Admin "Báo cáo": a generated export (Excel/PDF) or a saved dashboard definition. */
@Entity({ name: 'reports' })
@Index(['status', 'createdAt'])
export class Report extends TimestampedEntity {
  /** e.g. "Doanh thu theo sản phẩm". */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Report type key for the generator, e.g. "revenue_by_product". */
  @Column({ type: 'varchar', length: 60 })
  kind: string;

  /** "Kỳ dữ liệu" label, e.g. "Tháng 08/2026". */
  @Column({ name: 'period_label', type: 'varchar', length: 100 })
  periodLabel: string;

  @Column({ name: 'period_start', type: 'datetime', nullable: true })
  periodStart: Date | null;

  @Column({ name: 'period_end', type: 'datetime', nullable: true })
  periodEnd: Date | null;

  @Column({ type: 'enum', enum: ReportFormat, default: ReportFormat.Excel })
  format: ReportFormat;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.Generating,
  })
  status: ReportStatus;

  /** Filters used to build the report. */
  @Column({ type: 'json', nullable: true })
  params: Record<string, unknown> | null;

  @Column({ name: 'file_url', type: 'varchar', length: 500, nullable: true })
  fileUrl: string | null;

  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errorMessage: string | null;

  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: Relation<User> | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;
}
