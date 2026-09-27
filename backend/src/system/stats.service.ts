import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AnalyticsService, type TrafficStats } from './analytics.service.js';

export type AdminStats = {
  generatedAt: string;
  today: {
    revenue: number;
    revenueChangePercent: number | null;
    orders: number;
    ordersChangePercent: number | null;
    newCustomers: number;
    newCustomersChangePercent: number | null;
  };
  refundRatePercent: number;
  revenueByDay: { date: string; revenue: number; orders: number }[];
  ordersByStatus: Record<string, number>;
  lowStock: {
    variantId: number;
    productId: number;
    sku: string;
    productName: string;
    available: number;
    threshold: number;
  }[];
  recentActivity: {
    type: 'order' | 'fund_request' | 'ticket' | 'customer';
    title: string;
    detail: string;
    at: string;
  }[];
  badges: {
    orders: number;
    inventory: number;
    deposits: number;
    support: number;
  };
  traffic: TrafficStats;
};

const PAID_STATUSES = "('processing','completed')";

/** Numbers behind the admin overview and sidebar badges, computed straight from MySQL. */
@Injectable()
export class StatsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly analytics: AnalyticsService,
  ) {}

  async overview(): Promise<AdminStats> {
    const q = <T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ) => this.dataSource.query(sql, params) as Promise<T[]>;

    const [todayRow] = await q<{ revenue: string; orders: string }>(
      `SELECT COALESCE(SUM(total),0) revenue, COUNT(*) orders FROM orders
       WHERE status IN ${PAID_STATUSES} AND DATE(paid_at) = CURDATE()`,
    );
    const [yesterdayRow] = await q<{ revenue: string; orders: string }>(
      `SELECT COALESCE(SUM(total),0) revenue, COUNT(*) orders FROM orders
       WHERE status IN ${PAID_STATUSES} AND DATE(paid_at) = CURDATE() - INTERVAL 1 DAY`,
    );
    const [customersToday] = await q<{ n: string }>(
      `SELECT COUNT(*) n FROM users WHERE role='customer' AND DATE(created_at) = CURDATE()`,
    );
    const [customersYesterday] = await q<{ n: string }>(
      `SELECT COUNT(*) n FROM users WHERE role='customer' AND DATE(created_at) = CURDATE() - INTERVAL 1 DAY`,
    );
    const [refund] = await q<{ refunded: string; total: string }>(
      `SELECT SUM(status='refunded') refunded, COUNT(*) total FROM orders
       WHERE created_at >= NOW() - INTERVAL 30 DAY`,
    );
    const revenueByDay = await q<{
      date: string;
      revenue: string;
      orders: string;
    }>(
      `SELECT DATE_FORMAT(d.day,'%Y-%m-%d') date, COALESCE(SUM(o.total),0) revenue, COUNT(o.id) orders
       FROM (SELECT CURDATE() - INTERVAL n DAY day FROM (
         SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
         UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11) days) d
       LEFT JOIN orders o ON DATE(o.paid_at) = d.day AND o.status IN ${PAID_STATUSES}
       GROUP BY d.day ORDER BY d.day`,
    );
    const statusRows = await q<{ status: string; n: string }>(
      `SELECT status, COUNT(*) n FROM orders GROUP BY status`,
    );
    const lowStock = await q<{
      variantId: number;
      productId: number;
      sku: string;
      productName: string;
      available: string;
      threshold: number;
    }>(
      `SELECT v.id variantId, p.id productId, v.sku, p.name productName, p.low_stock_threshold threshold,
              (SELECT COUNT(*) FROM inventory_items i WHERE i.variant_id = v.id AND i.status='available') available
       FROM product_variants v INNER JOIN products p ON p.id = v.product_id
       WHERE v.delivery_type='auto' AND v.is_enabled = 1 AND p.deleted_at IS NULL AND p.status='active'
       HAVING available < threshold ORDER BY available ASC, v.id ASC LIMIT 5`,
    );
    const [badges] = await q<{
      orders: string;
      deposits: string;
      support: string;
      inventory: string;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM orders WHERE status IN ('pending_payment','processing')) orders,
        (SELECT COUNT(*) FROM fund_requests WHERE status IN ('pending','processing')) deposits,
        (SELECT COUNT(*) FROM support_tickets WHERE status IN ('new','in_progress')) support,
        (SELECT COUNT(*) FROM product_variants v INNER JOIN products p ON p.id = v.product_id
          WHERE v.delivery_type='auto' AND v.is_enabled=1 AND p.deleted_at IS NULL AND p.status='active'
          AND (SELECT COUNT(*) FROM inventory_items i WHERE i.variant_id=v.id AND i.status='available') < p.low_stock_threshold) inventory`,
    );
    const activity = await q<{
      type: string;
      title: string;
      detail: string;
      at: Date;
    }>(
      `(SELECT 'order' type, CONCAT('Đơn hàng #', code) title, CONCAT(customer_name, ' · ', FORMAT(total,0), 'đ') detail, created_at at FROM orders)
       UNION ALL
       (SELECT 'fund_request', CONCAT(IF(type='deposit','Yêu cầu nạp ','Yêu cầu rút '), code), CONCAT(FORMAT(amount,0),'đ'), created_at FROM fund_requests)
       UNION ALL
       (SELECT 'ticket', CONCAT('Phiếu hỗ trợ ', code), subject, created_at FROM support_tickets)
       UNION ALL
       (SELECT 'customer', CONCAT('Khách hàng mới: ', full_name), email, created_at FROM users WHERE role='customer')
       ORDER BY at DESC LIMIT 8`,
    );

    const pct = (current: number, previous: number) =>
      previous === 0
        ? current === 0
          ? 0
          : null
        : Math.round(((current - previous) / previous) * 1000) / 10;

    const todayRevenue = Number(todayRow.revenue);
    const yesterdayRevenue = Number(yesterdayRow.revenue);
    const todayOrders = Number(todayRow.orders);
    const yesterdayOrders = Number(yesterdayRow.orders);
    const newCustomers = Number(customersToday.n);
    const newCustomersYesterday = Number(customersYesterday.n);
    const refundedCount = Number(refund.refunded ?? 0);
    const totalCount = Number(refund.total ?? 0);
    const traffic = await this.analytics.overview();

    return {
      generatedAt: new Date().toISOString(),
      today: {
        revenue: todayRevenue,
        revenueChangePercent: pct(todayRevenue, yesterdayRevenue),
        orders: todayOrders,
        ordersChangePercent: pct(todayOrders, yesterdayOrders),
        newCustomers,
        newCustomersChangePercent: pct(newCustomers, newCustomersYesterday),
      },
      refundRatePercent: totalCount
        ? Math.round((refundedCount / totalCount) * 1000) / 10
        : 0,
      revenueByDay: revenueByDay.map((row) => ({
        date: row.date,
        revenue: Number(row.revenue),
        orders: Number(row.orders),
      })),
      ordersByStatus: Object.fromEntries(
        statusRows.map((row) => [row.status, Number(row.n)]),
      ),
      lowStock: lowStock.map((row) => ({
        ...row,
        available: Number(row.available),
      })),
      recentActivity: activity.map((row) => ({
        type: row.type as AdminStats['recentActivity'][number]['type'],
        title: row.title,
        detail: row.detail,
        at: new Date(row.at).toISOString(),
      })),
      badges: {
        orders: Number(badges.orders),
        inventory: Number(badges.inventory),
        deposits: Number(badges.deposits),
        support: Number(badges.support),
      },
      traffic,
    };
  }
}
