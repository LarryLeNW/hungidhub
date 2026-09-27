/** Admin "Giao dịch" > Loại: Thanh toán / Nạp tiền / Rút tiền / Hoàn tiền / Điều chỉnh. */
export enum WalletTransactionType {
  Payment = 'payment',
  Deposit = 'deposit',
  Withdrawal = 'withdrawal',
  Refund = 'refund',
  Adjustment = 'adjustment',
}

export enum WalletTransactionStatus {
  Pending = 'pending',
  Success = 'success',
  Failed = 'failed',
}

/** "Phương thức" column: Số dư AIHUB / Chuyển khoản / Zalo. */
export enum TransactionChannel {
  Wallet = 'wallet',
  BankTransfer = 'bank_transfer',
  Zalo = 'zalo',
  Manual = 'manual',
}

/** Admin "Nạp & rút tiền" > Loại. */
export enum FundRequestType {
  Deposit = 'deposit',
  Withdrawal = 'withdrawal',
}

/** Chờ duyệt / Đang xử lý / Hoàn tất / Từ chối. */
export enum FundRequestStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Rejected = 'rejected',
}
