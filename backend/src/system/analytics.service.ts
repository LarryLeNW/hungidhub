import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type TrafficStats = {
  today: { views: number; visitors: number; changePercent: number | null };
  byDay: { date: string; views: number; visitors: number }[];
  topPages: { path: string; views: number }[];
  devices: { desktop: number; mobile: number };
};

@Injectable()
export class AnalyticsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS traffic_page_views (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        session_id VARCHAR(64) NOT NULL,
        path VARCHAR(500) NOT NULL,
        referrer VARCHAR(1000) NULL,
        user_agent VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_traffic_created_at (created_at),
        INDEX idx_traffic_session_created (session_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    this.logger.log('Traffic analytics storage is ready');
  }

  async record(input: {
    sessionId: string;
    path: string;
    referrer?: string;
    userAgent?: string;
  }) {
    if (input.path === '/admin' || input.path.startsWith('/admin/')) return;

    // React development mode and rapid refreshes can fire twice. Keep only one
    // view for the same session/path in a five-second window.
    await this.dataSource.query(
      `INSERT INTO traffic_page_views (session_id, path, referrer, user_agent)
       SELECT ?, ?, ?, ? FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM traffic_page_views
         WHERE session_id = ? AND path = ? AND created_at >= NOW() - INTERVAL 5 SECOND
       )`,
      [
        input.sessionId,
        input.path,
        input.referrer || null,
        input.userAgent?.slice(0, 500) || null,
        input.sessionId,
        input.path,
      ],
    );
  }

  async overview(): Promise<TrafficStats> {
    const q = <T>(sql: string, params: unknown[] = []) =>
      this.dataSource.query(sql, params) as Promise<T[]>;
    const [today] = await q<{ views: string; visitors: string }>(
      `SELECT COUNT(*) views, COUNT(DISTINCT session_id) visitors
       FROM traffic_page_views WHERE DATE(created_at) = CURDATE()`,
    );
    const [yesterday] = await q<{ views: string }>(
      `SELECT COUNT(*) views FROM traffic_page_views
       WHERE DATE(created_at) = CURDATE() - INTERVAL 1 DAY`,
    );
    const byDay = await q<{ date: string; views: string; visitors: string }>(
      `SELECT DATE_FORMAT(d.day,'%Y-%m-%d') date, COUNT(v.id) views,
              COUNT(DISTINCT v.session_id) visitors
       FROM (SELECT CURDATE() - INTERVAL n DAY day FROM (
         SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
         UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
         UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13) days) d
       LEFT JOIN traffic_page_views v ON DATE(v.created_at) = d.day
       GROUP BY d.day ORDER BY d.day`,
    );
    const topPages = await q<{ path: string; views: string }>(
      `SELECT path, COUNT(*) views FROM traffic_page_views
       WHERE created_at >= CURDATE() - INTERVAL 13 DAY
       GROUP BY path ORDER BY views DESC, path ASC LIMIT 5`,
    );
    const [devices] = await q<{ desktop: string; mobile: string }>(
      `SELECT
         SUM(CASE WHEN user_agent REGEXP 'Mobile|Android|iPhone|iPad' THEN 0 ELSE 1 END) desktop,
         SUM(CASE WHEN user_agent REGEXP 'Mobile|Android|iPhone|iPad' THEN 1 ELSE 0 END) mobile
       FROM traffic_page_views WHERE created_at >= CURDATE() - INTERVAL 13 DAY`,
    );

    const views = Number(today.views);
    const previousViews = Number(yesterday.views);
    const changePercent = previousViews === 0
      ? views === 0 ? 0 : null
      : Math.round(((views - previousViews) / previousViews) * 1000) / 10;

    return {
      today: { views, visitors: Number(today.visitors), changePercent },
      byDay: byDay.map((row) => ({ date: row.date, views: Number(row.views), visitors: Number(row.visitors) })),
      topPages: topPages.map((row) => ({ path: row.path, views: Number(row.views) })),
      devices: { desktop: Number(devices.desktop ?? 0), mobile: Number(devices.mobile ?? 0) },
    };
  }
}
