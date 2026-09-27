import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { paginate } from '../common/utils/pagination.js';
import { Report } from './entities/report.entity.js';
import { ReportFormat, ReportStatus } from './system.enums.js';

export const REPORT_KINDS = {
  revenue_by_product: 'Doanh thu theo sản phẩm',
  revenue_by_category: 'Doanh thu theo danh mục',
  refund_rate: 'Tỷ lệ hoàn tiền',
  customers: 'Khách hàng mới & chi tiêu',
} as const;

export type ReportKind = keyof typeof REPORT_KINDS;

/**
 * Reports are computed synchronously from MySQL and stored as JSON in `params.result`
 * (format "dashboard"). File exports (Excel/PDF) can be layered on later.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const [items, total] = await this.reports.findAndCount({
      order: { id: 'DESC' },
      relations: { createdBy: true },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  async findById(id: number) {
    const report = await this.reports.findOne({
      where: { id },
      relations: { createdBy: true },
    });
    if (!report) throw new NotFoundException(`Không tìm thấy báo cáo #${id}`);
    return report;
  }

  async generate(
    input: {
      kind: ReportKind;
      periodStart: string;
      periodEnd: string;
      name?: string;
    },
    createdById: number,
  ) {
    if (!(input.kind in REPORT_KINDS)) {
      throw new BadRequestException(`Loại báo cáo "${input.kind}" không hợp lệ`);
    }
    const start = new Date(input.periodStart);
    const end = new Date(input.periodEnd);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start > end
    ) {
      throw new BadRequestException('Khoảng thời gian không hợp lệ');
    }

    const report = await this.reports.save(
      this.reports.create({
        name: input.name ?? REPORT_KINDS[input.kind],
        kind: input.kind,
        periodLabel: `${start.toLocaleDateString('vi-VN')} – ${end.toLocaleDateString('vi-VN')}`,
        periodStart: start,
        periodEnd: end,
        format: ReportFormat.Dashboard,
        status: ReportStatus.Generating,
        params: {
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
        },
        createdById,
      }),
    );

    try {
      const result = await this.compute(input.kind, start, end);
      report.params = { ...report.params, result };
      report.status = ReportStatus.Ready;
      report.completedAt = new Date();
    } catch (error) {
      report.status = ReportStatus.Failed;
      report.errorMessage =
        error instanceof Error ? error.message.slice(0, 500) : 'Unknown error';
    }
    return this.reports.save(report);
  }

  private async compute(kind: ReportKind, start: Date, end: Date) {
    const params = [start, end];
    switch (kind) {
      case 'revenue_by_product':
        return this.dataSource.query(
          `SELECT oi.product_name productName, SUM(oi.quantity) quantity, SUM(oi.line_total) revenue
           FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id
           WHERE o.status IN ('processing','completed') AND o.paid_at BETWEEN ? AND ?
           GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 100`,
          params,
        );
      case 'revenue_by_category':
        return this.dataSource.query(
          `SELECT c.name category, SUM(oi.line_total) revenue, COUNT(DISTINCT o.id) orders
           FROM order_items oi
           INNER JOIN orders o ON o.id = oi.order_id
           LEFT JOIN product_categories pc ON pc.product_id = oi.product_id
           LEFT JOIN categories c ON c.id = pc.category_id
           WHERE o.status IN ('processing','completed') AND o.paid_at BETWEEN ? AND ?
           GROUP BY c.name ORDER BY revenue DESC`,
          params,
        );
      case 'refund_rate':
        return this.dataSource.query(
          `SELECT DATE_FORMAT(created_at,'%Y-%m-%d') date, COUNT(*) orders, SUM(status='refunded') refunded,
                  SUM(status='cancelled') cancelled
           FROM orders WHERE created_at BETWEEN ? AND ? GROUP BY date ORDER BY date`,
          params,
        );
      case 'customers':
        return this.dataSource.query(
          `SELECT u.id, u.full_name fullName, u.email, u.created_at createdAt,
                  COUNT(o.id) orders, COALESCE(SUM(o.total),0) spent
           FROM users u LEFT JOIN orders o ON o.user_id = u.id AND o.status IN ('processing','completed')
           WHERE u.role='customer' AND u.created_at BETWEEN ? AND ?
           GROUP BY u.id ORDER BY spent DESC LIMIT 200`,
          params,
        );
    }
  }
}
