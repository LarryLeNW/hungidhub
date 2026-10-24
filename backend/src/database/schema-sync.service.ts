import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class SchemaSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaSyncService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    try {
      await this.ensureFundRequestsColumns();
      await this.ensureOrdersColumns();
      await this.ensureRefundRequestsTable();
    } catch (err) {
      this.logger.error('Failed to run schema auto-sync:', err);
    }
  }

  private async ensureFundRequestsColumns() {
    const hasCol = await this.columnExists('fund_requests', 'transaction_ref');
    if (!hasCol) {
      this.logger.log('Adding column transaction_ref to fund_requests...');
      await this.dataSource.query(
        `ALTER TABLE fund_requests ADD COLUMN transaction_ref VARCHAR(120) NULL;`,
      );
      try {
        await this.dataSource.query(
          `ALTER TABLE fund_requests ADD UNIQUE INDEX IDX_fund_requests_transaction_ref (transaction_ref);`,
        );
      } catch {
        // index might already exist
      }
      this.logger.log('Column transaction_ref added to fund_requests.');
    }
  }

  private async ensureOrdersColumns() {
    const hasCancelReason = await this.columnExists('orders', 'cancel_reason');
    if (!hasCancelReason) {
      this.logger.log('Adding column cancel_reason to orders...');
      await this.dataSource.query(
        `ALTER TABLE orders ADD COLUMN cancel_reason VARCHAR(255) NULL;`,
      );
    }

    const hasCancelledAt = await this.columnExists('orders', 'cancelled_at');
    if (!hasCancelledAt) {
      this.logger.log('Adding column cancelled_at to orders...');
      await this.dataSource.query(
        `ALTER TABLE orders ADD COLUMN cancelled_at DATETIME NULL;`,
      );
    }
  }

  private async ensureRefundRequestsTable() {
    const hasTable = await this.tableExists('refund_requests');
    if (!hasTable) {
      this.logger.log('Creating table refund_requests...');
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS refund_requests (
          id int NOT NULL AUTO_INCREMENT,
          created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          code varchar(25) NOT NULL,
          order_id int NOT NULL,
          user_id int DEFAULT NULL,
          customer_name varchar(120) NOT NULL,
          customer_email varchar(190) NOT NULL,
          customer_phone varchar(20) DEFAULT NULL,
          amount bigint NOT NULL DEFAULT '0',
          status enum('pending','processing','completed','rejected','cancelled') NOT NULL DEFAULT 'pending',
          refund_method enum('wallet','bank_transfer') NOT NULL DEFAULT 'wallet',
          reason varchar(150) NOT NULL,
          description text,
          bank_name varchar(100) DEFAULT NULL,
          bank_account_number varchar(50) DEFAULT NULL,
          bank_account_name varchar(120) DEFAULT NULL,
          proof_image_url varchar(500) DEFAULT NULL,
          reviewed_by_id int DEFAULT NULL,
          reviewed_at datetime DEFAULT NULL,
          admin_note varchar(255) DEFAULT NULL,
          reject_reason varchar(255) DEFAULT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY IDX_refund_requests_code (code),
          KEY IDX_refund_requests_order_id (order_id),
          KEY IDX_refund_requests_user_created (user_id, created_at),
          KEY IDX_refund_requests_status_created (status, created_at),
          CONSTRAINT FK_refund_requests_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
          CONSTRAINT FK_refund_requests_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
          CONSTRAINT FK_refund_requests_reviewer FOREIGN KEY (reviewed_by_id) REFERENCES users (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);
      this.logger.log('Table refund_requests created successfully.');
    }
  }

  private async columnExists(tableName: string, columnName: string): Promise<boolean> {
    const res = await this.dataSource.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, columnName],
    );
    return Array.isArray(res) && res.length > 0;
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const res = await this.dataSource.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName],
    );
    return Array.isArray(res) && res.length > 0;
  }
}
