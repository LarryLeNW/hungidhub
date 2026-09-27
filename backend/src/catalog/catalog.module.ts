import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminCategoriesController,
  AdminInventoryController,
  AdminProductsController,
  AdminReviewsController,
  AdminVariantsController,
  CategoriesController,
  ProductReviewsController,
  ProductsController,
} from './catalog.controllers.js';
import { CategoriesService } from './categories.service.js';
import { Category } from './entities/category.entity.js';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { InventoryMovement } from './entities/inventory-movement.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { ProductReview } from './entities/product-review.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { Product } from './entities/product.entity.js';
import { InventoryService } from './inventory.service.js';
import { ProductsService } from './products.service.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Category,
      Product,
      ProductImage,
      ProductVariant,
      ProductReview,
      InventoryItem,
      InventoryMovement,
    ]),
  ],
  controllers: [
    CategoriesController,
    ProductsController,
    ProductReviewsController,
    AdminCategoriesController,
    AdminProductsController,
    AdminVariantsController,
    AdminInventoryController,
    AdminReviewsController,
  ],
  providers: [
    CategoriesService,
    ProductsService,
    InventoryService,
    ReviewsService,
  ],
  exports: [
    CategoriesService,
    ProductsService,
    InventoryService,
    ReviewsService,
  ],
})
export class CatalogModule {}
