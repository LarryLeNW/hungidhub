import { readFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryType, ProductStatus } from '../catalog/catalog.enums.js';
import { Category } from '../catalog/entities/category.entity.js';
import { ProductVariant } from '../catalog/entities/product-variant.entity.js';
import { Product } from '../catalog/entities/product.entity.js';
import { PublishStatus } from '../content/content.enums.js';
import { Page } from '../content/entities/page.entity.js';
import { Post } from '../content/entities/post.entity.js';

/** Shape written by `scripts/sync-wp-content.mjs` in the Next.js app. */
type WpItem = {
  id: number;
  kind: 'product' | 'page' | 'post';
  slug: string;
  path: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  featuredImage: string | null;
  modified: string | null;
  categories: number[];
};

type WpCategory = {
  id: number;
  slug: string;
  path: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  parent: number;
  count: number;
};

type WpContent = {
  generatedAt: string;
  origin: string;
  products: WpItem[];
  pages: WpItem[];
  posts: WpItem[];
  productCategories: WpCategory[];
};

/** Same rebrand rules as `src/lib/brand.ts` on the client, applied once at import time. */
const BRAND_NAME = 'AIHUB';
const CONTACT_PHONE = '0931 729 316';
const CONTACT_EMAIL = 'larrylenw@gmail.com';

function replaceBrandText(value: string) {
  return value
    .replace(
      /0865\s*890\s*208|0865890208|0983\s*449\s*023|0983449023/g,
      CONTACT_PHONE,
    )
    .replace(
      /support@khotaikhoan\.net|khotaikhoan\.net@gmail\.com/g,
      CONTACT_EMAIL,
    )
    // (?!\.net) keeps khotaikhoan.net URLs intact — image/link domains must not be rebranded.
    .replace(
      /(?:Kho\s*Tài\s*Khoản|Kho\s*Tai\s*Khoan|KhoTaiKhoan)(?!\.net)/gi,
      BRAND_NAME,
    );
}

/** lucide icon per top-level category slug (mirrors the header menu on the client). */
const CATEGORY_ICONS: Record<string, string> = {
  'cong-cu-ai': 'Bot',
  'hoc-tap': 'GraduationCap',
  'lam-viec': 'Laptop',
  'giai-tri': 'Headphones',
  vpn: 'ShieldCheck',
  'luu-tru': 'Wrench',
  'anti-virus': 'ShieldCheck',
  'ung-dung-phan-mem-khac': 'Gamepad2',
};

const PAGE_TEMPLATES: Record<string, string> = {
  'gioi-thieu': 'about',
  blog: 'blog',
};

/** Placeholder pricing for imported products until admins enter real variants. */
const DEFAULT_VARIANT = { price: 99_000, regularPrice: 199_000 };

export type ImportSummary = {
  categories: number;
  products: number;
  variantsCreated: number;
  posts: number;
  pages: number;
};

@Injectable()
export class WpImportService {
  private readonly logger = new Logger(WpImportService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Page) private readonly pages: Repository<Page>,
  ) {}

  async importFromFile(filePath: string): Promise<ImportSummary> {
    const content = JSON.parse(await readFile(filePath, 'utf8')) as WpContent;
    this.logger.log(
      `Importing ${content.products.length} products, ${content.productCategories.length} categories, ${content.posts.length} posts, ${content.pages.length} pages (generated ${content.generatedAt})`,
    );

    const categoryIdByWpId = await this.importCategories(
      content.productCategories,
    );
    const productStats = await this.importProducts(
      content.products,
      categoryIdByWpId,
    );
    const posts = await this.importPosts(content.posts);
    const pages = await this.importPages(content.pages);

    const summary = {
      categories: categoryIdByWpId.size,
      ...productStats,
      posts,
      pages,
    };
    this.logger.log(`Import done: ${JSON.stringify(summary)}`);
    return summary;
  }

  private async importCategories(items: WpCategory[]) {
    const idByWpId = new Map<number, number>();
    let pending = [...items];
    let order = 0;

    // Parents first: resolve in passes until every parent has been imported.
    while (pending.length) {
      const ready = pending.filter(
        (item) => item.parent === 0 || idByWpId.has(item.parent),
      );
      if (!ready.length) {
        this.logger.warn(
          `Orphan categories skipped: ${pending.map((i) => i.slug).join(', ')}`,
        );
        break;
      }
      for (const item of ready) {
        const existing = await this.categories.findOneBy({ wpId: item.id });
        const category = existing ?? this.categories.create();
        Object.assign(category, {
          wpId: item.id,
          name: replaceBrandText(item.title),
          slug: item.slug,
          path: item.path,
          description: replaceBrandText(item.excerpt) || null,
          contentHtml: replaceBrandText(item.contentHtml) || null,
          parentId: item.parent ? (idByWpId.get(item.parent) ?? null) : null,
          icon: category.icon ?? CATEGORY_ICONS[item.slug] ?? null,
          sortOrder: existing ? category.sortOrder : order++,
          isVisible: existing ? category.isVisible : true,
        });
        const saved = await this.categories.save(category);
        idByWpId.set(item.id, saved.id);
      }
      pending = pending.filter((item) => !idByWpId.has(item.id));
    }
    return idByWpId;
  }

  private async importProducts(
    items: WpItem[],
    categoryIdByWpId: Map<number, number>,
  ) {
    let variantsCreated = 0;

    for (const item of items) {
      const existing = await this.products.findOne({
        where: { wpId: item.id },
        relations: { categories: true },
        withDeleted: true,
      });
      const product = existing ?? this.products.create();
      const categoryIds = item.categories
        .map((wpId) => categoryIdByWpId.get(wpId))
        .filter((id): id is number => typeof id === 'number');

      Object.assign(product, {
        wpId: item.id,
        name: replaceBrandText(item.title),
        slug: item.slug,
        shortDescription: replaceBrandText(item.excerpt) || null,
        contentHtml: replaceBrandText(item.contentHtml) || null,
        featuredImage: item.featuredImage,
        status: existing ? product.status : ProductStatus.Active,
        categories: categoryIds.map((id) => ({ id }) as Category),
      });
      const saved = await this.products.save(product);

      const variantCount = await this.variants.countBy({ productId: saved.id });
      if (variantCount === 0) {
        await this.variants.save(
          this.variants.create({
            productId: saved.id,
            sku: `WP-${item.id}`,
            name: 'Gói mặc định',
            accountType: 'Gói mặc định',
            price: DEFAULT_VARIANT.price,
            regularPrice: DEFAULT_VARIANT.regularPrice,
            deliveryType: DeliveryType.Manual,
            sortOrder: 0,
          }),
        );
        variantsCreated += 1;
      }
    }
    return { products: items.length, variantsCreated };
  }

  private async importPosts(items: WpItem[]) {
    for (const item of items) {
      const existing = await this.posts.findOneBy({ wpId: item.id });
      const post = existing ?? this.posts.create();
      Object.assign(post, {
        wpId: item.id,
        title: replaceBrandText(item.title),
        slug: item.slug,
        excerpt: replaceBrandText(item.excerpt) || null,
        contentHtml: replaceBrandText(item.contentHtml) || null,
        featuredImage: item.featuredImage,
        status: existing ? post.status : PublishStatus.Published,
        publishedAt:
          post.publishedAt ??
          (item.modified ? new Date(item.modified) : new Date()),
      });
      await this.posts.save(post);
    }
    return items.length;
  }

  private async importPages(items: WpItem[]) {
    let imported = 0;
    for (const item of items) {
      if (!item.path) continue; // the WP front page has an empty path
      const existing = await this.pages.findOneBy({ wpId: item.id });
      const page = existing ?? this.pages.create();
      Object.assign(page, {
        wpId: item.id,
        title: replaceBrandText(item.title),
        slug: item.slug,
        excerpt: replaceBrandText(item.excerpt) || null,
        contentHtml: replaceBrandText(item.contentHtml) || null,
        featuredImage: item.featuredImage,
        template: page.template ?? PAGE_TEMPLATES[item.path] ?? null,
        status: existing ? page.status : PublishStatus.Published,
        publishedAt:
          page.publishedAt ??
          (item.modified ? new Date(item.modified) : new Date()),
      });
      await this.pages.save(page);
      imported += 1;
    }
    return imported;
  }
}
