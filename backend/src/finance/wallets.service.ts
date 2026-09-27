import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { assignCode, placeholderCode } from '../common/utils/codes.js';
import { paginate } from '../common/utils/pagination.js';
import { NotificationsService } from '../system/notifications.service.js';
import {
  NotificationSection,
  NotificationTone,
} from '../system/system.enums.js';
import { FundRequest } from './entities/fund-request.entity.js';
import { WalletTransaction } from './entities/wallet-transaction.entity.js';
import { Wallet } from './entities/wallet.entity.js';
import {
  FundRequestStatus,
  FundRequestType,
  TransactionChannel,
  WalletTransactionStatus,
  WalletTransactionType,
} from './finance.enums.js';

export type LedgerEntry = {
  type: WalletTransactionType;
  channel?: TransactionChannel;
  orderId?: number | null;
  fundRequestId?: number | null;
  description?: string | null;
  createdById?: number | null;
};

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly transactions: Repository<WalletTransaction>,
    @InjectRepository(FundRequest)
    private readonly fundRequests: Repository<FundRequest>,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async getOrCreate(
    userId: number,
    manager: EntityManager = this.wallets.manager,
  ) {
    const existing = await manager.findOneBy(Wallet, { userId });
    if (existing) return existing;
    return manager.save(
      manager.create(Wallet, { userId, balance: 0, currency: 'VND' }),
    );
  }

  async getMine(userId: number) {
    return this.getOrCreate(userId);
  }

  async listMyTransactions(userId: number, query: PaginationQueryDto) {
    const wallet = await this.getOrCreate(userId);
    const [items, total] = await this.transactions.findAndCount({
      where: { walletId: wallet.id },
      order: { id: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  /** Adds `amount` (positive) to the wallet. Runs in the caller's transaction. */
  credit(
    manager: EntityManager,
    userId: number,
    amount: number,
    entry: LedgerEntry,
  ) {
    return this.post(manager, userId, Math.abs(amount), entry);
  }

  /** Removes `amount` (positive) from the wallet; fails with 409 when the balance is short. */
  debit(
    manager: EntityManager,
    userId: number,
    amount: number,
    entry: LedgerEntry,
  ) {
    return this.post(manager, userId, -Math.abs(amount), entry);
  }

  private async post(
    manager: EntityManager,
    userId: number,
    delta: number,
    entry: LedgerEntry,
  ) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new BadRequestException('Số tiền không hợp lệ');
    }
    await this.getOrCreate(userId, manager);
    const wallet = await manager
      .createQueryBuilder(Wallet, 'wallet')
      .setLock('pessimistic_write')
      .where('wallet.user_id = :userId', { userId })
      .getOneOrFail();

    const balanceAfter = wallet.balance + delta;
    if (balanceAfter < 0) {
      throw new ConflictException('Số dư AIHUB không đủ');
    }

    wallet.balance = balanceAfter;
    await manager.save(wallet);

    const transaction = await manager.save(
      manager.create(WalletTransaction, {
        code: placeholderCode(),
        walletId: wallet.id,
        type: entry.type,
        channel: entry.channel ?? TransactionChannel.Wallet,
        amount: delta,
        balanceAfter,
        status: WalletTransactionStatus.Success,
        orderId: entry.orderId ?? null,
        fundRequestId: entry.fundRequestId ?? null,
        description: entry.description ?? null,
        createdById: entry.createdById ?? null,
      }),
    );
    transaction.code = await assignCode(
      manager,
      WalletTransaction,
      transaction.id,
      'GD-',
      700000,
    );
    return transaction;
  }

  // ---------------------------------------------------------- fund requests

  async createFundRequest(
    userId: number,
    input: {
      type: FundRequestType;
      amount: number;
      bankName?: string;
      bankAccountNumber?: string;
      bankAccountName?: string;
      note?: string;
    },
  ) {
    if (input.type === FundRequestType.Withdrawal) {
      const wallet = await this.getOrCreate(userId);
      const pending = await this.fundRequests
        .createQueryBuilder('request')
        .select('COALESCE(SUM(request.amount), 0)', 'sum')
        .where('request.user_id = :userId', { userId })
        .andWhere('request.type = :type', { type: FundRequestType.Withdrawal })
        .andWhere('request.status IN (:...statuses)', {
          statuses: [FundRequestStatus.Pending, FundRequestStatus.Processing],
        })
        .getRawOne<{ sum: string }>();
      if (wallet.balance - Number(pending?.sum ?? 0) < input.amount) {
        throw new ConflictException('Số dư khả dụng không đủ để rút');
      }
      if (
        !input.bankName ||
        !input.bankAccountNumber ||
        !input.bankAccountName
      ) {
        throw new BadRequestException('Cần thông tin ngân hàng để rút tiền');
      }
    }

    return this.dataSource
      .transaction(async (manager) => {
        const request = await manager.save(
          manager.create(FundRequest, {
            code: placeholderCode(),
            userId,
            type: input.type,
            amount: input.amount,
            status: FundRequestStatus.Pending,
            bankName: input.bankName ?? null,
            bankAccountNumber: input.bankAccountNumber ?? null,
            bankAccountName: input.bankAccountName ?? null,
            transferContent: null,
            proofImageUrl: null,
            note: input.note ?? null,
          }),
        );
        request.code = await assignCode(
          manager,
          FundRequest,
          request.id,
          'YC-',
          3000,
        );
        if (input.type === FundRequestType.Deposit) {
          request.transferContent = `NAP ${request.code}`;
          await manager.save(request);
        }
        return request;
      })
      .then(async (request) => {
        await this.notifications.notifyAdmins({
          title: `${input.type === FundRequestType.Deposit ? 'Yêu cầu nạp' : 'Yêu cầu rút'} ${request.code}`,
          body: `${request.amount.toLocaleString('vi-VN')}đ đang chờ duyệt.`,
          section: NotificationSection.Deposits,
          tone: NotificationTone.Amber,
          entityType: 'fund_request',
          entityId: request.id,
        });
        return request;
      });
  }

  /** Admin "Giao dịch": the full wallet ledger with the account owner. */
  async listTransactionsAdmin(
    query: PaginationQueryDto,
    filter: {
      type?: WalletTransactionType;
      status?: WalletTransactionStatus;
      search?: string;
    },
  ) {
    const qb = this.transactions
      .createQueryBuilder('transaction')
      .innerJoinAndSelect('transaction.wallet', 'wallet')
      .innerJoinAndSelect('wallet.user', 'user')
      .orderBy('transaction.id', 'DESC');
    if (filter.type)
      qb.andWhere('transaction.type = :type', { type: filter.type });
    if (filter.status)
      qb.andWhere('transaction.status = :status', { status: filter.status });
    if (filter.search) {
      qb.andWhere(
        '(transaction.code LIKE :search OR user.email LIKE :search OR user.fullName LIKE :search)',
        { search: `%${filter.search.trim()}%` },
      );
    }
    const [items, total] = await qb
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();
    return paginate(items, total, query);
  }

  async listFundRequests(
    query: PaginationQueryDto,
    filter: { userId?: number; status?: FundRequestStatus },
  ) {
    const [items, total] = await this.fundRequests.findAndCount({
      where: { ...filter },
      relations: { user: true },
      order: { id: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  /** Admin approval: credits (deposit) or debits (withdrawal) the wallet and closes the request. */
  async approveFundRequest(id: number, reviewerId: number, note?: string) {
    return this.dataSource.transaction(async (manager) => {
      const request = await manager.findOneBy(FundRequest, { id });
      if (!request)
        throw new NotFoundException(`Không tìm thấy yêu cầu #${id}`);
      if (
        request.status !== FundRequestStatus.Pending &&
        request.status !== FundRequestStatus.Processing
      ) {
        throw new ConflictException('Yêu cầu đã được xử lý');
      }

      const entry: LedgerEntry = {
        type:
          request.type === FundRequestType.Deposit
            ? WalletTransactionType.Deposit
            : WalletTransactionType.Withdrawal,
        channel: TransactionChannel.BankTransfer,
        fundRequestId: request.id,
        description: `${request.type === FundRequestType.Deposit ? 'Nạp' : 'Rút'} tiền ${request.code}`,
        createdById: reviewerId,
      };
      if (request.type === FundRequestType.Deposit) {
        await this.credit(manager, request.userId, request.amount, entry);
      } else {
        await this.debit(manager, request.userId, request.amount, entry);
      }

      request.status = FundRequestStatus.Completed;
      request.reviewedById = reviewerId;
      request.reviewedAt = new Date();
      request.note = note ?? request.note;
      return manager.save(request);
    });
  }

  async rejectFundRequest(id: number, reviewerId: number, reason: string) {
    const request = await this.fundRequests.findOneBy({ id });
    if (!request) throw new NotFoundException(`Không tìm thấy yêu cầu #${id}`);
    if (request.status === FundRequestStatus.Completed) {
      throw new ConflictException('Yêu cầu đã hoàn tất, không thể từ chối');
    }
    request.status = FundRequestStatus.Rejected;
    request.reviewedById = reviewerId;
    request.reviewedAt = new Date();
    request.rejectReason = reason;
    return this.fundRequests.save(request);
  }
}
