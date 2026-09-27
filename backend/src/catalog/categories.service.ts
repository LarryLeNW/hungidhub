import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { slugify } from '../common/utils/slug.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { Category } from './entities/category.entity.js';

export type CategoryNode = Category & { children: CategoryNode[] };

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  /** Visible categories as a nested tree ordered by `sort_order` (storefront menu). */
  async findTree(
    includeHidden = false,
    withCounts = false,
  ): Promise<CategoryNode[]> {
    const rows = await this.categories.find({
      where: includeHidden ? {} : { isVisible: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    if (withCounts) {
      const counts = await this.categories.manager.query<
        { categoryId: number; count: string }[]
      >(
        `SELECT pc.category_id categoryId, COUNT(*) count
         FROM product_categories pc INNER JOIN products p ON p.id = pc.product_id
         WHERE p.deleted_at IS NULL GROUP BY pc.category_id`,
      );
      const byId = new Map(
        counts.map((row) => [Number(row.categoryId), Number(row.count)]),
      );
      for (const row of rows) {
        (row as Category & { productCount: number }).productCount =
          byId.get(row.id) ?? 0;
      }
    }
    return buildTree(rows);
  }

  findAllFlat() {
    return this.categories.find({ order: { path: 'ASC' } });
  }

  /** Resolves "cong-cu-ai" or "ung-dung-phan-mem-khac/cong-cu-ai". */
  async findBySlugOrPath(value: string) {
    const normalized = value.replace(/^\/+|\/+$/g, '');
    const category = await this.categories.findOne({
      where: [{ path: normalized }, { slug: normalized }],
    });
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }
    return category;
  }

  async findById(id: number) {
    const category = await this.categories.findOneBy({ id });
    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục #${id}`);
    }
    return category;
  }

  /** The category plus every descendant id (for product filtering). */
  async collectDescendantIds(categoryId: number) {
    const all = await this.categories.find({
      select: { id: true, parentId: true },
    });
    const ids = new Set<number>([categoryId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const row of all) {
        if (
          row.parentId !== null &&
          ids.has(row.parentId) &&
          !ids.has(row.id)
        ) {
          ids.add(row.id);
          grew = true;
        }
      }
    }
    return [...ids];
  }

  async create(dto: CreateCategoryDto) {
    const parent = dto.parentId ? await this.findById(dto.parentId) : null;
    const slug = dto.slug ?? slugify(dto.name);
    const path = parent ? `${parent.path}/${slug}` : slug;
    await this.assertPathFree(path);
    await this.assertSlugFree(slug);

    const category = this.categories.create({
      ...dto,
      slug,
      path,
      parentId: parent?.id ?? null,
      description: dto.description ?? null,
      contentHtml: dto.contentHtml ?? null,
      imageUrl: dto.imageUrl ?? null,
      icon: dto.icon ?? null,
      seoTitle: dto.seoTitle ?? null,
      seoDescription: dto.seoDescription ?? null,
    });
    return this.categories.save(category);
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const category = await this.findById(id);

    if (dto.parentId !== undefined && dto.parentId !== category.parentId) {
      if (dto.parentId === id) {
        throw new ConflictException('Danh mục không thể là cha của chính nó');
      }
      if (dto.parentId) {
        const descendants = await this.collectDescendantIds(id);
        if (descendants.includes(dto.parentId)) {
          throw new ConflictException(
            'Không thể chuyển danh mục vào trong danh mục con của nó',
          );
        }
      }
    }

    const parentId =
      dto.parentId === undefined ? category.parentId : dto.parentId;
    const parent = parentId ? await this.findById(parentId) : null;
    const slug = dto.slug ?? category.slug;
    const path = parent ? `${parent.path}/${slug}` : slug;

    if (path !== category.path) {
      await this.assertPathFree(path, id);
    }
    if (slug !== category.slug) {
      await this.assertSlugFree(slug, id);
    }

    Object.assign(category, dto, { slug, path, parentId: parent?.id ?? null });
    const saved = await this.categories.save(category);

    if (path !== category.path || slug !== category.slug) {
      await this.rewriteDescendantPaths(saved);
    }
    return saved;
  }

  async remove(id: number) {
    const category = await this.findById(id);
    const childCount = await this.categories.countBy({ parentId: id });
    if (childCount > 0) {
      throw new ConflictException('Vui lòng chuyển hoặc xóa các danh mục con trước');
    }
    await this.categories.softDelete({ id });
  }

  private async assertPathFree(path: string, exceptId?: number) {
    const existing = await this.categories.findOne({ where: { path }, withDeleted: true });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(
        existing.deletedAt
          ? `Đường dẫn "${path}" thuộc một danh mục đã xóa mềm, vui lòng chọn slug khác`
          : `Đường dẫn "${path}" đã tồn tại, vui lòng chọn slug khác`,
      );
    }
  }

  private async assertSlugFree(slug: string, exceptId?: number) {
    const existing = await this.categories.findOne({ where: { slug }, withDeleted: true });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(
        existing.deletedAt
          ? `Slug "${slug}" thuộc một danh mục đã xóa mềm, vui lòng chọn slug khác`
          : `Slug "${slug}" đã được dùng cho danh mục "${existing.name}", vui lòng chọn slug khác`,
      );
    }
  }

  private async rewriteDescendantPaths(parent: Category) {
    const children = await this.categories.findBy({ parentId: parent.id });
    for (const child of children) {
      child.path = `${parent.path}/${child.slug}`;
      await this.categories.save(child);
      await this.rewriteDescendantPaths(child);
    }
  }
}

function buildTree(rows: Category[]): CategoryNode[] {
  const byId = new Map<number, CategoryNode>();
  for (const row of rows) {
    byId.set(row.id, Object.assign(row, { children: [] as CategoryNode[] }));
  }
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId !== null ? byId.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
