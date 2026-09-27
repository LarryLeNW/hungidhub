/** Matches the admin sidebar sections a notification deep-links to. */
export enum NotificationSection {
  Orders = 'orders',
  Products = 'products',
  Inventory = 'inventory',
  Customers = 'customers',
  Transactions = 'transactions',
  Deposits = 'deposits',
  Categories = 'categories',
  Promotions = 'promotions',
  Content = 'content',
  Support = 'support',
  Reports = 'reports',
  Settings = 'settings',
}

export enum NotificationTone {
  Cyan = 'cyan',
  Blue = 'blue',
  Green = 'green',
  Amber = 'amber',
  Danger = 'danger',
}

/** Admin "Cài đặt" > Nhóm cài đặt. */
export enum SettingGroup {
  Store = 'store',
  Payment = 'payment',
  Roles = 'roles',
  Notifications = 'notifications',
  Integrations = 'integrations',
}

export enum ReportFormat {
  Excel = 'excel',
  Pdf = 'pdf',
  Dashboard = 'dashboard',
}

/** Đang tạo / Sẵn sàng / Lỗi. */
export enum ReportStatus {
  Generating = 'generating',
  Ready = 'ready',
  Failed = 'failed',
}
