/** Admin "Trạng thái" on orders: Chờ thanh toán / Đang xử lý / Hoàn tất / Đã hủy / Hoàn tiền. */
export enum OrderStatus {
  PendingPayment = 'pending_payment',
  Processing = 'processing',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Refunded = 'refunded',
}

/** Storefront checkout offers bank transfer or Zalo; signed-in users can also pay from their wallet. */
export enum PaymentMethod {
  BankTransfer = 'bank_transfer',
  Zalo = 'zalo',
  Wallet = 'wallet',
}

export enum PaymentStatus {
  Pending = 'pending',
  Paid = 'paid',
  Failed = 'failed',
  Refunded = 'refunded',
}

export enum OrderItemDeliveryStatus {
  Pending = 'pending',
  Delivered = 'delivered',
  Failed = 'failed',
}
