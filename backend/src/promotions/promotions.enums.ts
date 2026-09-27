/** "Ưu đãi" column: 10% (percent) / 50.000đ (fixed). */
export enum PromotionType {
  Percent = 'percent',
  Fixed = 'fixed',
}

/** Đã lên lịch / Đang chạy / Tạm dừng / Đã kết thúc. */
export enum PromotionStatus {
  Scheduled = 'scheduled',
  Active = 'active',
  Paused = 'paused',
  Ended = 'ended',
}

export enum PromotionScope {
  All = 'all',
  Categories = 'categories',
  Products = 'products',
}
