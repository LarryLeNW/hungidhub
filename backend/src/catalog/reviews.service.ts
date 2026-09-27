import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { paginate } from '../common/utils/pagination.js';
import { ProductStatus, ReviewStatus } from './catalog.enums.js';
import { ProductReview } from './entities/product-review.entity.js';
import { Product } from './entities/product.entity.js';

export type CreateReviewInput = {
  authorName: string;
  rating: number;
  content: string;
};

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ProductReview)
    private readonly reviews: Repository<ProductReview>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async listApproved(slug: string, query: PaginationQueryDto, rating?: number) {
    const product = await this.findActiveProduct(slug);
    const [items, total] = await this.reviews.findAndCount({
      where: {
        productId: product.id,
        status: ReviewStatus.Approved,
        ...(rating ? { rating } : {}),
      },
      order: { id: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return {
      ...paginate(items, total, query),
      summary: {
        ratingAverage: product.ratingAverage,
        reviewCount: product.reviewCount,
      },
    };
  }

  /** Public submissions are held for moderation. */
  async create(slug: string, input: CreateReviewInput, userId: number | null) {
    const product = await this.findActiveProduct(slug);
    return this.reviews.save(
      this.reviews.create({
        productId: product.id,
        userId,
        orderItemId: null,
        authorName: input.authorName.trim(),
        rating: input.rating,
        content: input.content.trim(),
        status: ReviewStatus.Pending,
      }),
    );
  }

  async listAdmin(query: PaginationQueryDto, status?: ReviewStatus) {
    const [items, total] = await this.reviews.findAndCount({
      where: status ? { status } : {},
      relations: { product: true },
      order: { id: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  async setStatus(id: number, status: ReviewStatus) {
    const review = await this.reviews.findOneBy({ id });
    if (!review) throw new NotFoundException(`Không tìm thấy đánh giá #${id}`);
    review.status = status;
    await this.reviews.save(review);
    await this.recomputeProductRating(review.productId);
    return review;
  }

  /** Keeps `products.rating_average` / `review_count` in sync with approved reviews. */
  async recomputeProductRating(productId: number) {
    const row = await this.reviews
      .createQueryBuilder('review')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(AVG(review.rating), 0)', 'average')
      .where('review.product_id = :productId AND review.status = :status', {
        productId,
        status: ReviewStatus.Approved,
      })
      .getRawOne<{ count: string; average: string }>();
    await this.products.update(
      { id: productId },
      {
        reviewCount: Number(row?.count ?? 0),
        ratingAverage: Math.round(Number(row?.average ?? 0) * 100) / 100,
      },
    );
  }

  private async findActiveProduct(slug: string) {
    const product = await this.products.findOneBy({
      slug,
      status: ProductStatus.Active,
    });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    return product;
  }
}
