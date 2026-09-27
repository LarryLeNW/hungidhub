/** Thấp / Trung bình / Cao. */
export enum TicketPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

/** Mới / Đang xử lý / Chờ phản hồi / Đã giải quyết / Đã đóng. */
export enum TicketStatus {
  New = 'new',
  InProgress = 'in_progress',
  WaitingCustomer = 'waiting_customer',
  Resolved = 'resolved',
  Closed = 'closed',
}

export enum TicketAuthorType {
  Customer = 'customer',
  Staff = 'staff',
  System = 'system',
}
