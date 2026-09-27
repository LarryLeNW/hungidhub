import { Category } from '../catalog/entities/category.entity.js';
import { InventoryItem } from '../catalog/entities/inventory-item.entity.js';
import { InventoryMovement } from '../catalog/entities/inventory-movement.entity.js';
import { ProductImage } from '../catalog/entities/product-image.entity.js';
import { ProductReview } from '../catalog/entities/product-review.entity.js';
import { ProductVariant } from '../catalog/entities/product-variant.entity.js';
import { Product } from '../catalog/entities/product.entity.js';
import { WishlistItem } from '../catalog/entities/wishlist-item.entity.js';
import { ContentBlock } from '../content/entities/content-block.entity.js';
import { Page } from '../content/entities/page.entity.js';
import { PostCategory } from '../content/entities/post-category.entity.js';
import { Post } from '../content/entities/post.entity.js';
import { FundRequest } from '../finance/entities/fund-request.entity.js';
import { WalletTransaction } from '../finance/entities/wallet-transaction.entity.js';
import { Wallet } from '../finance/entities/wallet.entity.js';
import { OrderItem } from '../orders/entities/order-item.entity.js';
import { Order } from '../orders/entities/order.entity.js';
import { Payment } from '../orders/entities/payment.entity.js';
import { PromotionUsage } from '../promotions/entities/promotion-usage.entity.js';
import { Promotion } from '../promotions/entities/promotion.entity.js';
import { SupportMessage } from '../support/entities/support-message.entity.js';
import { SupportTicket } from '../support/entities/support-ticket.entity.js';
import { AuditLog } from '../system/entities/audit-log.entity.js';
import { Notification } from '../system/entities/notification.entity.js';
import { Report } from '../system/entities/report.entity.js';
import { Setting } from '../system/entities/setting.entity.js';
import { User } from '../users/entities/user.entity.js';

/**
 * Every entity registered with TypeORM. Feature modules still call
 * `TypeOrmModule.forFeature([...])` for the repositories they inject.
 */
export const ALL_ENTITIES = [
  // accounts
  User,
  Wallet,
  WalletTransaction,
  FundRequest,
  // catalog
  Category,
  Product,
  ProductImage,
  ProductVariant,
  InventoryItem,
  InventoryMovement,
  ProductReview,
  WishlistItem,
  // sales
  Order,
  OrderItem,
  Payment,
  Promotion,
  PromotionUsage,
  // content
  Post,
  PostCategory,
  Page,
  ContentBlock,
  // support & system
  SupportTicket,
  SupportMessage,
  Notification,
  Setting,
  Report,
  AuditLog,
];
