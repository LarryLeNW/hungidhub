import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ProductVariant } from '../catalog/entities/product-variant.entity.js';
import { FinanceModule } from '../finance/finance.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { Setting } from '../system/entities/setting.entity.js';
import { SystemModule } from '../system/system.module.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Order } from './entities/order.entity.js';
import { Payment } from './entities/payment.entity.js';
import { RefundRequest } from './entities/refund-request.entity.js';
import {
  AdminOrdersController,
  OrdersController,
} from './orders.controllers.js';
import { OrdersService } from './orders.service.js';
import { CassoWebhookController } from './casso-webhook.controller.js';
import { CassoWebhookService } from './casso-webhook.service.js';
import {
  AdminRefundRequestsController,
  RefundRequestsController,
} from './refund-requests.controllers.js';
import { RefundRequestsService } from './refund-requests.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Payment,
      RefundRequest,
      ProductVariant,
      Setting,
    ]),
    CatalogModule,
    PromotionsModule,
    FinanceModule,
    SystemModule,
  ],
  controllers: [
    OrdersController,
    AdminOrdersController,
    CassoWebhookController,
    RefundRequestsController,
    AdminRefundRequestsController,
  ],
  providers: [OrdersService, CassoWebhookService, RefundRequestsService],
  exports: [OrdersService, RefundRequestsService],
})
export class OrdersModule {}
