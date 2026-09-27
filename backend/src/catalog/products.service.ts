import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { paginate } from '../common/utils/pagination.js';
import { slugify } from '../common/utils/slug.js';
import { CategoriesService } from './categories.service.js';
import {
  DeliveryType,
  InventoryItemStatus,
  ProductStatus,
  StockStatus,
} from './catalog.enums.js';
import {
  CreateProductDto,
  CreateVariantDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/product.dto.js';
import {
  ProductSort,
  QueryAdminProductsDto,
  QueryProductsDto,
} from './dto/query-products.dto.js';
import { Category } from './entities/category.entity.js';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { Product } from './entities/product.entity.js';

export type StockSummary = { available: number; reserved: number };

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    @InjectRepository(ProductImage)
    private readonly images: Repository<ProductImage>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(InventoryItem)
    private readonly inventory: Repository<InventoryItem>,
    private readonly categoriesService: CategoriesService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------- storefront

  async findPublic(query: QueryProductsDto) {
    const qb = this.products
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.variants', 'variant', 'variant.isEnabled = 1')
      .leftJoinAndSelect('product.categories', 'category')
      .where('product.status = :status', { status: ProductStatus.Active });

    if (query.ids?.length) {
      qb.andWhere('product.id IN (:...ids)', { ids: query.ids });
    }
    if (query.slugs?.length) {
      qb.andWhere('product.slug IN (:...slugs)', { slugs: query.slugs });
    }

    if (query.category) {
      const category = await this.categoriesService.findBySlugOrPath(
        query.category,
      );
      const ids = await this.categoriesService.collectDescendantIds(
        category.id,
      );
      qb.andWhere(
        'product.id IN (SELECT pc.product_id FROM product_categories pc WHERE pc.category_id IN (:...categoryIds))',
        { categoryIds: ids },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(product.name LIKE :search OR product.shortDescription LIKE :search)',
        {
          search: `%${query.search.trim()}%`,
        },
      );
    }

    if (query.badge) {
      qb.andWhere('JSON_CONTAINS(product.badges, JSON_QUOTE(:badge))', {
        badge: query.badge,
      });
    }

    // Cheapest enabled variant, used for price sorting.
    qb.addSelect(
      (sub) =>
        sub
          .select('MIN(v.price)')
          .from(ProductVariant, 'v')
          .where('v.product_id = product.id AND v.is_enabled = 1'),
      'min_price',
    );

    switch (query.sort) {
      case ProductSort.Newest:
        qb.orderBy('product.createdAt', 'DESC');
        break;
      case ProductSort.PriceAsc:
        qb.orderBy('min_price', 'ASC');
        break;
      case ProductSort.PriceDesc:
        qb.orderBy('min_price', 'DESC');
        break;
      case ProductSort.BestSelling:
        qb.orderBy('product.soldCount', 'DESC');
        break;
      default:
        qb.orderBy('product.sortOrder', 'ASC').addOrderBy(
          'product.soldCount',
          'DESC',
        );
    }
    qb.addOrderBy('product.id', 'DESC').addOrderBy('variant.sortOrder', 'ASC');

    const [items, total] = await qb
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();

    if (query.ids?.length) {
      const order = new Map(query.ids.map((id, index) => [id, index]));
      items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    } else if (query.slugs?.length) {
      const order = new Map(query.slugs.map((slug, index) => [slug, index]));
      items.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
    }

    return paginate(items, total, query);
  }

  async findPublicBySlug(slug: string) {
    const product = await this.products.findOne({
      where: { slug, status: ProductStatus.Active },
      relations: { variants: true, images: true, categories: true },
      order: { variants: { sortOrder: 'ASC' }, images: { sortOrder: 'ASC' } },
    });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }
    product.variants = product.variants.filter((variant) => variant.isEnabled);
    return product;
  }

  // -------------------------------------------------------------------- admin

  async findAdmin(query: QueryAdminProductsDto) {
    const qb = this.products
      .createQueryBuilder('product')
      .withDeleted()
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('product.categories', 'category')
      .where('product.deletedAt IS NULL')
      .orderBy('product.updatedAt', 'DESC')
      .addOrderBy('variant.sortOrder', 'ASC');

    if (query.status) {
      qb.andWhere('product.status = :status', { status: query.status });
    }
    if (query.categoryId) {
      qb.andWhere(
        'product.id IN (SELECT pc.product_id FROM product_categories pc WHERE pc.category_id = :categoryId)',
        { categoryId: query.categoryId },
      );
    }
    if (query.search) {
      qb.andWhere('(product.name LIKE :search OR variant.sku LIKE :search)', {
        search: `%${query.search.trim()}%`,
      });
    }

    const [items, total] = await qb
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();
    const stock = await this.stockByVariant(
      items.flatMap((product) => product.variants.map((variant) => variant.id)),
    );

    const rows = items.map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        stock: stock.get(variant.id) ?? { available: 0, reserved: 0 },
      })),
    }));
    return paginate(rows, total, query);
  }

  async findAdminById(id: number) {
    const product = await this.products.findOne({
      where: { id },
      relations: { variants: true, images: true, categories: true },
      order: { variants: { sortOrder: 'ASC' }, images: { sortOrder: 'ASC' } },
    });
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm #${id}`);
    }
    const stock = await this.stockByVariant(
      product.variants.map((variant) => variant.id),
    );
    return {
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        stock: stock.get(variant.id) ?? { available: 0, reserved: 0 },
      })),
    };
  }

  async create(dto: CreateProductDto) {
    const slug = dto.slug ?? slugify(dto.name);
    await this.assertSlugFree(slug);
    const categories = await this.resolveCategories(dto.categoryIds);

    return this.dataSource.transaction(async (manager) => {
      const product = await manager.save(
        manager.create(Product, {
          name: dto.name,
          slug,
          shortDescription: dto.shortDescription ?? null,
          contentHtml: dto.contentHtml ?? null,
          featuredImage: dto.featuredImage ?? null,
          badges: dto.badges ?? null,
          status: dto.status ?? ProductStatus.Draft,
          lowStockThreshold: dto.lowStockThreshold ?? 10,
          warrantyDays: dto.warrantyDays ?? null,
          deliveryTimeText: dto.deliveryTimeText ?? null,
          sortOrder: dto.sortOrder ?? 0,
          seoTitle: dto.seoTitle ?? null,
          seoDescription: dto.seoDescription ?? null,
          categories,
        }),
      );

      if (dto.images?.length) {
        await manager.save(
          dto.images.map((image, index) =>
            manager.create(ProductImage, {
              productId: product.id,
              src: image.src,
              alt: image.alt ?? null,
              sortOrder: index,
            }),
          ),
        );
      }

      for (const [index, variant] of (dto.variants ?? []).entries()) {
        await manager.save(
          manager.create(
            ProductVariant,
            this.variantFromDto(product, variant, index),
          ),
        );
      }

      return manager.findOneOrFail(Product, {
        where: { id: product.id },
        relations: { variants: true, images: true, categories: true },
      });
    });
  }

  async update(id: number, dto: UpdateProductDto) {
    const product = await this.products.findOne({
      where: { id },
      relations: { categories: true },
    });
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm #${id}`);
    }

    if (dto.slug && dto.slug !== product.slug) {
      await this.assertSlugFree(dto.slug, id);
    }
    if (dto.categoryIds) {
      product.categories = await this.resolveCategories(dto.categoryIds);
    }

    const { categoryIds: _c, images, variants: _v, ...fields } = dto;
    Object.assign(product, fields);

    return this.dataSource.transaction(async (manager) => {
      await manager.save(product);
      if (images) {
        await manager.delete(ProductImage, { productId: id });
        if (images.length) {
          await manager.save(
            images.map((image, index) =>
              manager.create(ProductImage, {
                productId: id,
                src: image.src,
                alt: image.alt ?? null,
                sortOrder: index,
              }),
            ),
          );
        }
      }
      return manager.findOneOrFail(Product, {
        where: { id },
        relations: { variants: true, images: true, categories: true },
      });
    });
  }

  async updateStatus(id: number, status: ProductStatus) {
    await this.findAdminById(id);
    await this.products.update({ id }, { status });
    return this.findAdminById(id);
  }

  /** Soft delete: order history keeps pointing at the row. */
  async remove(id: number) {
    await this.findAdminById(id);
    await this.products.softDelete({ id });
  }

  // ----------------------------------------------------------------- variants

  async addVariant(productId: number, dto: CreateVariantDto) {
    const product = await this.products.findOneBy({ id: productId });
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm #${productId}`);
    }
    const count = await this.variants.countBy({ productId });
    if (dto.sku) {
      await this.assertSkuFree(dto.sku);
    }
    return this.variants.save(
      this.variants.create(this.variantFromDto(product, dto, count)),
    );
  }

  async updateVariant(variantId: number, dto: UpdateVariantDto) {
    const variant = await this.findVariant(variantId);
    if (dto.sku && dto.sku !== variant.sku) {
      await this.assertSkuFree(dto.sku, variantId);
    }
    Object.assign(variant, dto);
    return this.variants.save(variant);
  }

  async removeVariant(variantId: number) {
    const variant = await this.findVariant(variantId);
    const delivered = await this.inventory.countBy({
      variantId,
      status: InventoryItemStatus.Delivered,
    });
    if (delivered > 0) {
      throw new ConflictException(
        'Gói đã có kho bàn giao cho khách; hãy ẩn gói thay vì xóa',
      );
    }
    await this.variants.softDelete({ id: variantId });
  }

  async findVariant(variantId: number) {
    const variant = await this.variants.findOne({
      where: { id: variantId },
      relations: { product: true },
    });
    if (!variant) {
      throw new NotFoundException(`Không tìm thấy gói sản phẩm #${variantId}`);
    }
    return variant;
  }

  /** Available / reserved counts per variant id (admin "Kho hàng"). */
  async stockByVariant(variantIds: number[]) {
    const result = new Map<number, StockSummary>();
    if (!variantIds.length) return result;

    const rows = await this.inventory
      .createQueryBuilder('item')
      .select('item.variant_id', 'variantId')
      .addSelect('item.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('item.variant_id IN (:...variantIds)', { variantIds })
      .andWhere('item.status IN (:...statuses)', {
        statuses: [InventoryItemStatus.Available, InventoryItemStatus.Reserved],
      })
      .groupBy('item.variant_id')
      .addGroupBy('item.status')
      .getRawMany<{
        variantId: number;
        status: InventoryItemStatus;
        count: string;
      }>();

    for (const row of rows) {
      const summary = result.get(Number(row.variantId)) ?? {
        available: 0,
        reserved: 0,
      };
      if (row.status === InventoryItemStatus.Available)
        summary.available = Number(row.count);
      if (row.status === InventoryItemStatus.Reserved)
        summary.reserved = Number(row.count);
      result.set(Number(row.variantId), summary);
    }
    return result;
  }

  // ------------------------------------------------------------------ helpers

  private variantFromDto(
    product: Product,
    dto: CreateVariantDto,
    index: number,
  ): Partial<ProductVariant> {
    return {
      productId: product.id,
      sku:
        dto.sku ??
        `${slugify(product.slug).toUpperCase().slice(0, 40)}-${Date.now().toString(36).toUpperCase()}${index}`,
      name: dto.name,
      accountType: dto.accountType ?? null,
      duration: dto.duration ?? null,
      durationDays: dto.durationDays ?? null,
      price: dto.price,
      regularPrice: dto.regularPrice ?? null,
      costPrice: dto.costPrice ?? null,
      stockStatus: dto.stockStatus ?? StockStatus.InStock,
      deliveryType: dto.deliveryType ?? DeliveryType.Auto,
      warrantyDays: dto.warrantyDays ?? null,
      isEnabled: dto.isEnabled ?? true,
      sortOrder: dto.sortOrder ?? index,
    };
  }

  private async resolveCategories(ids?: number[]) {
    if (!ids?.length) return [];
    const categories = await this.categories.findBy({ id: In(ids) });
    if (categories.length !== new Set(ids).size) {
      throw new NotFoundException('Một hoặc nhiều danh mục không tồn tại');
    }
    return categories;
  }

  private async assertSlugFree(slug: string, exceptId?: number) {
    const existing = await this.products.findOne({
      where: { slug },
      withDeleted: true,
    });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`Slug sản phẩm "${slug}" đã tồn tại`);
    }
  }

  private async assertSkuFree(sku: string, exceptId?: number) {
    const existing = await this.variants.findOne({
      where: { sku },
      withDeleted: true,
    });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`SKU "${sku}" đã tồn tại`);
    }
  }
}
