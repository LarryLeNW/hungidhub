/** Admin "Trạng thái" column on products: Đang bán / Ẩn / Nháp. "Sắp hết" and "Hết hàng" are derived from stock. */
export enum ProductStatus {
  Draft = 'draft',
  Active = 'active',
  Hidden = 'hidden',
}

export enum StockStatus {
  InStock = 'in_stock',
  OutOfStock = 'out_of_stock',
  Backorder = 'backorder',
}

/** How a variant is fulfilled after payment. */
export enum DeliveryType {
  /** Credentials are taken from `inventory_items` automatically. */
  Auto = 'auto',
  /** Staff upgrades the customer's own account (e.g. "Chính chủ" packages). */
  Manual = 'manual',
}

/** Lifecycle of one digital stock unit (an account/key) in the warehouse. */
export enum InventoryItemStatus {
  Available = 'available',
  Reserved = 'reserved',
  Delivered = 'delivered',
  Revoked = 'revoked',
}

export enum InventoryMovementType {
  Import = 'import',
  Reserve = 'reserve',
  Release = 'release',
  Deliver = 'deliver',
  Revoke = 'revoke',
  Adjust = 'adjust',
}

export enum ReviewStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}
