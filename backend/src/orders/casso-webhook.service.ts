import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DataSource, Like } from 'typeorm';
import { EnvironmentVariables, NodeEnv } from '../config/env.validation.js';
import { DeliveryType } from '../catalog/catalog.enums.js';
import { Product } from '../catalog/entities/product.entity.js';
import { InventoryService } from '../catalog/inventory.service.js';
import { FundRequest } from '../finance/entities/fund-request.entity.js';
import { WalletTransaction } from '../finance/entities/wallet-transaction.entity.js';
import {
  FundRequestStatus,
  FundRequestType,
  TransactionChannel,
  WalletTransactionType,
} from '../finance/finance.enums.js';
import { WalletsService, LedgerEntry } from '../finance/wallets.service.js';
import { NotificationsService } from '../system/notifications.service.js';
import { NotificationSection, NotificationTone } from '../system/system.enums.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Order } from './entities/order.entity.js';
import { Payment } from './entities/payment.entity.js';
import { OrderItemDeliveryStatus, OrderStatus, PaymentMethod, PaymentStatus } from './orders.enums.js';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type CassoTransaction = {
  id: number | string;
  description: string;
  amount: number;
  reference?: string;
  tid?: string;
  accountNumber?: string;
  bank_sub_acc_id?: string;
  subAccId?: string;
  bankName?: string;
  bankAbbreviation?: string;
  transactionDateTime?: string;
  when?: string;
  [key: string]: unknown;
};

export type CassoWebhookBody = {
  error: number | string;
  data: CassoTransaction | CassoTransaction[];
};

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortJson(value[key])]),
    );
  }
  return value;
}

function sanitizeCassoBody(body: CassoWebhookBody): unknown {
  if (!body) return body;
  const sanitizeTx = (tx: CassoTransaction) => {
    if (!tx || typeof tx !== 'object') return tx;
    const { runningBalance, counterAccountNumber, counterAccountName, ...rest } = tx;
    return {
      ...rest,
      counterAccountName: counterAccountName ? `${String(counterAccountName).slice(0, 3)}***` : undefined,
      counterAccountNumber: counterAccountNumber ? `****${String(counterAccountNumber).slice(-4)}` : undefined,
      runningBalance: runningBalance !== undefined ? '[MASKED]' : undefined,
    };
  };

  const data = Array.isArray(body.data) ? body.data.map(sanitizeTx) : sanitizeTx(body.data);
  return { ...body, data };
}

/**
 * Casso V2 signs `timestamp + "." + JSON.stringify(body or data sorted recursively by key)`.
 * maxAgeMs (default: 5 minutes) protects against replay attacks. Pass 0 to disable time check.
 */
export function verifyCassoSignature(
  signatureHeader: string,
  body: CassoWebhookBody,
  secret: string,
  maxAgeMs = 300_000,
) {
  const match = /^t=(\d+),v1=([a-f\d]{128})$/i.exec(signatureHeader.trim());
  if (!match) return false;
  const t = Number(match[1]);
  if (!Number.isFinite(t)) return false;

  // Chống Replay attack: kiểm tra độ lệch thời gian không quá 5 phút
  if (maxAgeMs > 0 && Math.abs(Date.now() - t) > maxAgeMs) {
    return false;
  }

  const received = Buffer.from(match[2], 'hex');

  // Thử ký theo toàn bộ body (chuẩn canonical)
  const bodyMessage = `${match[1]}.${JSON.stringify(sortJson(body as unknown as JsonValue))}`;
  const bodyExpected = createHmac('sha512', secret).update(bodyMessage).digest();
  if (received.length === bodyExpected.length && timingSafeEqual(received, bodyExpected)) {
    return true;
  }

  // Thử ký theo body.data
  if (body.data) {
    const dataMessage = `${match[1]}.${JSON.stringify(sortJson(body.data as unknown as JsonValue))}`;
    const dataExpected = createHmac('sha512', secret).update(dataMessage).digest();
    if (received.length === dataExpected.length && timingSafeEqual(received, dataExpected)) {
      return true;
    }
  }

  return false;
}

export function orderCodesFromDescription(description: string) {
  const matches = description.toUpperCase().match(/(?:^|[^A-Z0-9])(AH\d+)(?=$|[^A-Z0-9])/g) ?? [];
  return [...new Set(matches.map((value) => /AH\d+/.exec(value)?.[0]).filter((value): value is string => Boolean(value)))];
}

export function fundRequestCodesFromDescription(description: string) {
  const matches = description.toUpperCase().match(/(?:^|[^A-Z0-9])(YC-?\d+)(?=$|[^A-Z0-9])/g) ?? [];
  return [
    ...new Set(
      matches
        .map((value) => /YC-?\d+/.exec(value)?.[0])
        .filter((value): value is string => Boolean(value))
        .map((code) => (code.includes('-') ? code : code.replace('YC', 'YC-'))),
    ),
  ];
}

@Injectable()
export class CassoWebhookService {
  private readonly logger = new Logger(CassoWebhookService.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly dataSource: DataSource,
    private readonly inventory: InventoryService,
    private readonly notifications: NotificationsService,
    private readonly wallets: WalletsService,
  ) {}

  async handle(body: CassoWebhookBody, headers: { signature?: string; secureToken?: string }) {
    this.logger.log(`Nhận webhook từ Casso: headers=${JSON.stringify(headers)} body=${JSON.stringify(sanitizeCassoBody(body))}`);
    const secret = this.config.get('CASSO_WEBHOOK_SECRET', { infer: true })?.trim();
    const isDev = this.config.get('NODE_ENV', { infer: true }) !== NodeEnv.Production;

    let isAuthorized = false;
    if (secret) {
      if (headers.signature && verifyCassoSignature(headers.signature, body, secret)) {
        isAuthorized = true;
      }
      if (!isAuthorized && headers.secureToken && headers.secureToken === secret) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      // Cho phép test event (data rỗng) vượt qua để Casso kết nối thử ban đầu
      if (!body.data || (Array.isArray(body.data) && body.data.length === 0)) {
        this.logger.log('Casso test webhook ping nhận thành công (dữ liệu kiểm tra kết nối)');
        return { error: 0, success: true, message: 'Test connection successful', matched: 0, ignored: 0 };
      }

      // Có dữ liệu giao dịch thật: BẮT BUỘC phải xác thực hợp lệ nếu CASSO_WEBHOOK_SECRET đã cấu hình
      if (secret) {
        if (headers.signature) {
          throw new UnauthorizedException('Chữ ký webhook Casso không hợp lệ');
        }
        throw new UnauthorizedException('Mã bảo mật webhook Casso không hợp lệ');
      }

      if (!isDev) {
        this.logger.error('Webhook Casso chưa được cấu hình biến CASSO_WEBHOOK_SECRET trong .env');
        throw new ServiceUnavailableException('Webhook Casso chưa được cấu hình');
      }
      this.logger.warn('Casso webhook: CASSO_WEBHOOK_SECRET chưa được cấu hình ở môi trường dev.');
    }

    if (!body || Number(body.error) !== 0) {
      this.logger.warn(`Casso gửi webhook có error=${String(body?.error)}`);
      return { error: Number(body?.error) || 1, success: false, matched: 0, ignored: 0 };
    }

    // Nếu là test event (data rỗng hoặc mảng rỗng)
    if (!body.data || (Array.isArray(body.data) && body.data.length === 0)) {
      this.logger.log('Casso test webhook ping nhận thành công (dữ liệu kiểm tra kết nối)');
      return { error: 0, success: true, message: 'Test connection successful', matched: 0, ignored: 0 };
    }

    const transactions = Array.isArray(body.data) ? body.data : [body.data];

    // Phát hiện và xử lý test event gửi từ Casso dashboard (id: 0, accountNumber: 88888888, reference: MA_GIAO_DICH_THU_NGHIEM...)
    const isTestTx = transactions.some(
      (tx) =>
        Number(tx.id) === 0 ||
        tx.reference === 'MA_GIAO_DICH_THU_NGHIEM' ||
        tx.accountNumber === '88888888' ||
        tx.description?.toLowerCase().includes('thu nghiem') ||
        tx.description?.toLowerCase().includes('thử nghiệm'),
    );

    if (isTestTx) {
      this.logger.log('Casso gửi giao dịch thử nghiệm (Test Webhook) thành công. Đã xác nhận kết nối OK.');
      return {
        error: 0,
        success: true,
        message: 'Test webhook transaction received successfully',
        matched: 0,
        ignored: 0,
      };
    }

    let matched = 0;
    for (const transaction of transactions) {
      if (await this.matchTransaction(transaction)) matched += 1;
    }
    return { error: 0, success: true, matched, ignored: transactions.length - matched };
  }

  private async matchTransaction(transaction: CassoTransaction) {
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) return false;

    const expectedAccount = this.config.get('CASSO_ACCOUNT_NUMBER', { infer: true });
    const receivedAccount = transaction.accountNumber ?? transaction.bank_sub_acc_id ?? transaction.subAccId;
    if (expectedAccount && receivedAccount) {
      const allowed = expectedAccount
        .split(',')
        .map((a) => a.replace(/\s/g, '').toUpperCase())
        .filter(Boolean);
      const cleanReceived = receivedAccount.replace(/\s/g, '').toUpperCase();
      if (allowed.length > 0 && !allowed.includes(cleanReceived)) {
        this.logger.warn(
          `Bỏ qua giao dịch Casso #${String(transaction.id)}: số tài khoản nhận '${receivedAccount}' không khớp cấu hình [${allowed.join(', ')}]`,
        );
        return false;
      }
    }

    const codes = orderCodesFromDescription(transaction.description ?? '');
    const fundRequestCodes = fundRequestCodesFromDescription(transaction.description ?? '');
    if (!codes.length && !fundRequestCodes.length) return false;
    const transactionRef = `CASSO:${String(transaction.id)}`.slice(0, 120);

    return this.dataSource.transaction(async (manager) => {
      if (await manager.findOne(Payment, { where: { transactionRef } })) return false;
      if (await manager.findOne(FundRequest, { where: { transactionRef } })) return false;
      const alreadyFunded = await manager.findOne(WalletTransaction, {
        where: { description: Like(`%${transactionRef}%`) },
      });
      if (alreadyFunded) return false;

      // Xử lý nạp tiền vào ví nếu có mã yêu cầu nạp YC...
      if (fundRequestCodes.length > 0) {
        const fundRequest = await manager.createQueryBuilder(FundRequest, 'req')
          .setLock('pessimistic_write')
          .where('req.code IN (:...fundRequestCodes)', { fundRequestCodes })
          .andWhere('req.status = :status', { status: FundRequestStatus.Pending })
          .andWhere('req.type = :type', { type: FundRequestType.Deposit })
          .getOne();

        if (fundRequest) {
          if (amount < fundRequest.amount) {
            this.logger.warn(
              `Casso: Yêu cầu nạp #${fundRequest.code} chuyển thiếu tiền (cần ${fundRequest.amount}đ, nhận ${amount}đ). Giao dịch: ${transactionRef}`,
            );
            void this.notifications.notifyAdmins({
              title: `Yêu cầu nạp #${fundRequest.code} chuyển thiếu tiền`,
              body: `Cần nạp ${fundRequest.amount.toLocaleString('vi-VN')}đ nhưng chuyển ${amount.toLocaleString('vi-VN')}đ qua Casso.`,
              section: NotificationSection.Deposits,
              tone: NotificationTone.Amber,
              entityType: 'fund_request',
              entityId: fundRequest.id,
            });
            return false;
          }

          const entry: LedgerEntry = {
            type: WalletTransactionType.Deposit,
            channel: TransactionChannel.BankTransfer,
            fundRequestId: fundRequest.id,
            description: `Nạp tiền ${fundRequest.code} tự động qua Casso (${transactionRef})`,
          };
          await this.wallets.credit(manager, fundRequest.userId, amount, entry);

          fundRequest.transactionRef = transactionRef;
          fundRequest.status = FundRequestStatus.Completed;
          fundRequest.reviewedAt = new Date();
          fundRequest.note = `Tự động duyệt qua Casso (${transactionRef})`;
          if (amount > fundRequest.amount) {
            fundRequest.amount = amount;
          }
          await manager.save(fundRequest);

          this.logger.log(
            `Casso đã xác nhận và nạp ${amount}đ cho yêu cầu #${fundRequest.code} (user #${fundRequest.userId})`,
          );

          void this.notifications.notifyAdmins({
            title: `Nạp tiền thành công #${fundRequest.code}`,
            body: `Đã cộng ${amount.toLocaleString('vi-VN')}đ vào ví người dùng #${fundRequest.userId} qua Casso.`,
            section: NotificationSection.Deposits,
            tone: NotificationTone.Green,
            entityType: 'fund_request',
            entityId: fundRequest.id,
          });

          return true;
        }
      }

      if (!codes.length) return false;

      const order = await manager.createQueryBuilder(Order, 'order')
        .setLock('pessimistic_write')
        .where('order.code IN (:...codes)', { codes })
        .andWhere('order.status = :status', { status: OrderStatus.PendingPayment })
        .andWhere('order.paymentMethod = :method', { method: PaymentMethod.BankTransfer })
        .getOne();
      if (!order) return false;

      // 1. Khách chuyển thiếu tiền: Cảnh báo admin và không tự động xuất kho
      if (amount < order.total) {
        this.logger.warn(
          `Casso: Đơn #${order.code} chuyển thiếu tiền (cần ${order.total}đ, nhận ${amount}đ). Giao dịch: ${transactionRef}`,
        );
        void this.notifications.notifyAdmins({
          title: `Đơn hàng #${order.code} chuyển thiếu tiền`,
          body: `${order.customerName} · Cần ${order.total.toLocaleString('vi-VN')}đ nhưng chuyển ${amount.toLocaleString('vi-VN')}đ qua Casso. Đơn vẫn chờ thanh toán.`,
          section: NotificationSection.Orders,
          tone: NotificationTone.Amber,
          entityType: 'order',
          entityId: order.id,
        });
        return false;
      }

      // 2. Khách chuyển thừa tiền: Hoàn thành đơn và cảnh báo admin hoàn trả tiền thừa
      const isOverpaid = amount > order.total;
      if (isOverpaid) {
        this.logger.warn(
          `Casso: Đơn #${order.code} chuyển thừa tiền (cần ${order.total}đ, nhận ${amount}đ). Giao dịch: ${transactionRef}`,
        );
        void this.notifications.notifyAdmins({
          title: `Đơn hàng #${order.code} chuyển thừa (+${(amount - order.total).toLocaleString('vi-VN')}đ)`,
          body: `${order.customerName} · Cần ${order.total.toLocaleString('vi-VN')}đ nhưng chuyển ${amount.toLocaleString('vi-VN')}đ qua Casso. Vui lòng kiểm tra hoàn tiền thừa.`,
          section: NotificationSection.Orders,
          tone: NotificationTone.Amber,
          entityType: 'order',
          entityId: order.id,
        });
      }

      const payment = await manager.findOne(Payment, {
        where: { orderId: order.id, method: PaymentMethod.BankTransfer, status: PaymentStatus.Pending },
      });
      if (!payment) return false;

      const paidAt = new Date();
      payment.status = PaymentStatus.Paid;
      payment.amount = amount;
      payment.paidAt = paidAt;
      payment.provider = transaction.bankAbbreviation ?? transaction.bankName ?? 'BIDV';
      payment.transactionRef = transactionRef;
      payment.rawPayload = transaction;

      try {
        await manager.save(payment);
      } catch (err) {
        if ((err as { code?: string })?.code === 'ER_DUP_ENTRY' || (err as Error)?.message?.includes('Duplicate')) {
          this.logger.warn(`Bỏ qua giao dịch trùng lặp ${transactionRef}`);
          return false;
        }
        throw err;
      }

      // Kiểm tra xem đơn hàng có thể xuất kho tự động 100% được không
      const items = await manager.find(OrderItem, {
        where: { orderId: order.id },
        relations: { variant: true, product: true },
      });

      let canAutoComplete = items.length > 0;
      for (const item of items) {
        const deliveryType = item.variant?.deliveryType ?? DeliveryType.Manual;
        if (deliveryType !== DeliveryType.Auto || !item.variantId) {
          canAutoComplete = false;
          break;
        }
        const available = await this.inventory.countAvailable(item.variantId, manager);
        if (available < item.quantity) {
          canAutoComplete = false;
          break;
        }
      }

      if (canAutoComplete) {
        for (const item of items) {
          await this.inventory.deliverForOrderItem(
            manager,
            item.variantId!,
            item.id,
            item.quantity,
            null,
          );

          const warrantyDays =
            item.variant?.warrantyDays ?? item.product?.warrantyDays ?? null;
          item.deliveryStatus = OrderItemDeliveryStatus.Delivered;
          item.deliveredAt = paidAt;
          item.warrantyUntil = warrantyDays
            ? new Date(paidAt.getTime() + warrantyDays * 86_400_000)
            : null;
          await manager.save(item);

          if (item.productId) {
            await manager.increment(
              Product,
              { id: item.productId },
              'soldCount',
              item.quantity,
            );
          }
        }

        await manager.update(Order, { id: order.id }, {
          status: OrderStatus.Completed,
          paidAt,
          completedAt: paidAt,
        });
        this.logger.log(`Casso đã xác nhận và xuất kho tự động cho đơn #${order.code} (${transactionRef})`);

        void this.notifications.notifyAdmins({
          title: `Đơn hàng #${order.code} đã hoàn tất tự động`,
          body: `${order.customerName} · ${amount.toLocaleString('vi-VN')}đ qua Casso · Đã giao tài khoản từ kho`,
          section: NotificationSection.Orders,
          tone: NotificationTone.Green,
          entityType: 'order',
          entityId: order.id,
        });
      } else {
        await manager.update(Order, { id: order.id }, { status: OrderStatus.Processing, paidAt });
        this.logger.log(`Casso đã xác nhận thanh toán cho đơn #${order.code} (${transactionRef}), chờ xử lý giao hàng`);

        void this.notifications.notifyAdmins({
          title: `Đơn hàng #${order.code} đã thanh toán`,
          body: `${order.customerName} · ${amount.toLocaleString('vi-VN')}đ qua Casso · Chờ giao hàng thủ công`,
          section: NotificationSection.Orders,
          tone: NotificationTone.Cyan,
          entityType: 'order',
          entityId: order.id,
        });
      }

      return true;
    });
  }
}
