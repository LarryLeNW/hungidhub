import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EnvironmentVariables } from '../config/env.validation.js';
import { Order } from './entities/order.entity.js';
import { Payment } from './entities/payment.entity.js';
import { OrderStatus, PaymentMethod, PaymentStatus } from './orders.enums.js';

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

/** Casso V2 signs `timestamp + "." + JSON.stringify(body sorted recursively by key)`. */
export function verifyCassoSignature(
  signatureHeader: string,
  body: CassoWebhookBody,
  secret: string,
) {
  const match = /^t=(\d+),v1=([a-f\d]{128})$/i.exec(signatureHeader.trim());
  if (!match) return false;
  const message = `${match[1]}.${JSON.stringify(sortJson(body as unknown as JsonValue))}`;
  const expected = createHmac('sha512', secret).update(message).digest();
  const received = Buffer.from(match[2], 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function orderCodesFromDescription(description: string) {
  const matches = description.toUpperCase().match(/(?:^|[^A-Z0-9])(AH\d+)(?=$|[^A-Z0-9])/g) ?? [];
  return [...new Set(matches.map((value) => /AH\d+/.exec(value)?.[0]).filter((value): value is string => Boolean(value)))];
}

@Injectable()
export class CassoWebhookService {
  private readonly logger = new Logger(CassoWebhookService.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly dataSource: DataSource,
  ) {}

  async handle(body: CassoWebhookBody, headers: { signature?: string; secureToken?: string }) {
    const secret = this.config.get('CASSO_WEBHOOK_SECRET', { infer: true });
    if (!secret) throw new ServiceUnavailableException('Webhook Casso chưa được cấu hình');

    if (headers.signature) {
      if (!verifyCassoSignature(headers.signature, body, secret)) {
        throw new UnauthorizedException('Chữ ký webhook Casso không hợp lệ');
      }
    } else if (!headers.secureToken || headers.secureToken !== secret) {
      throw new UnauthorizedException('Mã bảo mật webhook Casso không hợp lệ');
    }

    if (Number(body.error) !== 0) {
      this.logger.warn(`Casso gửi webhook có error=${String(body.error)}`);
      return { success: true, matched: 0, ignored: 0 };
    }

    const transactions = Array.isArray(body.data) ? body.data : [body.data];
    let matched = 0;
    for (const transaction of transactions) {
      if (await this.matchTransaction(transaction)) matched += 1;
    }
    return { success: true, matched, ignored: transactions.length - matched };
  }

  private async matchTransaction(transaction: CassoTransaction) {
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) return false;

    const expectedAccount = this.config.get('CASSO_ACCOUNT_NUMBER', { infer: true });
    const receivedAccount = transaction.accountNumber ?? transaction.bank_sub_acc_id ?? transaction.subAccId;
    if (
      expectedAccount &&
      receivedAccount?.replace(/\s/g, '') !== expectedAccount.replace(/\s/g, '')
    ) return false;

    const codes = orderCodesFromDescription(transaction.description ?? '');
    if (!codes.length) return false;
    const transactionRef = `CASSO:${String(transaction.id)}`.slice(0, 120);

    return this.dataSource.transaction(async (manager) => {
      if (await manager.findOne(Payment, { where: { transactionRef } })) return false;

      const order = await manager.createQueryBuilder(Order, 'order')
        .setLock('pessimistic_write')
        .where('order.code IN (:...codes)', { codes })
        .andWhere('order.status = :status', { status: OrderStatus.PendingPayment })
        .andWhere('order.paymentMethod = :method', { method: PaymentMethod.BankTransfer })
        .andWhere('order.total = :amount', { amount })
        .getOne();
      if (!order) return false;

      const payment = await manager.findOne(Payment, {
        where: { orderId: order.id, method: PaymentMethod.BankTransfer, status: PaymentStatus.Pending },
      });
      if (!payment) return false;

      const paidAt = new Date();
      payment.status = PaymentStatus.Paid;
      payment.paidAt = paidAt;
      payment.provider = transaction.bankAbbreviation ?? transaction.bankName ?? 'Casso';
      payment.transactionRef = transactionRef;
      payment.rawPayload = transaction;
      await manager.save(payment);
      await manager.update(Order, { id: order.id }, { status: OrderStatus.Processing, paidAt });
      this.logger.log(`Casso confirmed order ${order.code} (${transactionRef})`);
      return true;
    });
  }
}
