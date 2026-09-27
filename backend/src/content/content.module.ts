import {
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Public } from '../common/decorators/public.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { paginate } from '../common/utils/pagination.js';
import {
  AdminContentController,
  ContentAdminService,
} from './content-admin.js';
import { PublishStatus } from './content.enums.js';
import { ContentBlock } from './entities/content-block.entity.js';
import { Page } from './entities/page.entity.js';
import { PostCategory } from './entities/post-category.entity.js';
import { Post } from './entities/post.entity.js';

export class QueryPostsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Post category slug' })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Page) private readonly pages: Repository<Page>,
    @InjectRepository(ContentBlock)
    private readonly blocks: Repository<ContentBlock>,
  ) {}

  async listPosts(query: QueryPostsDto) {
    const qb = this.posts
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.categories', 'category')
      .where('post.status = :status', { status: PublishStatus.Published })
      .orderBy('post.publishedAt', 'DESC')
      .addOrderBy('post.id', 'DESC');

    if (query.category) {
      qb.andWhere(
        'post.id IN (SELECT l.post_id FROM post_category_links l INNER JOIN post_categories c ON c.id = l.post_category_id WHERE c.slug = :category)',
        { category: query.category },
      );
    }
    if (query.search) {
      qb.andWhere('(post.title LIKE :search OR post.excerpt LIKE :search)', {
        search: `%${query.search.trim()}%`,
      });
    }

    // Reading time (~220 words/min) computed in SQL so the listing can skip the body.
    qb.addSelect(
      `CEIL((LENGTH(post.content_html) - LENGTH(REPLACE(post.content_html, ' ', '')) + 1) / 220)`,
      'reading_minutes',
    );
    const total = await qb.getCount();
    const { entities, raw } = await qb
      .skip(query.skip)
      .take(query.limit)
      .getRawAndEntities<{ reading_minutes: string }>();
    const minutesById = new Map<number, number>();
    for (const row of raw as ({ post_id?: number } & {
      reading_minutes: string;
    })[]) {
      if (row.post_id !== undefined) {
        minutesById.set(Number(row.post_id), Number(row.reading_minutes ?? 1));
      }
    }
    // Listing pages only need the excerpt.
    return paginate(
      entities.map((post) => ({
        ...post,
        contentHtml: undefined,
        readingMinutes: Math.max(1, minutesById.get(post.id) ?? 1),
      })),
      total,
      query,
    );
  }

  async getPost(slug: string) {
    const post = await this.posts.findOne({
      where: { slug, status: PublishStatus.Published },
      relations: { categories: true },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    const words = (post.contentHtml ?? '')
      .replace(/<[^>]+>/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
    return { ...post, readingMinutes: Math.max(1, Math.ceil(words / 220)) };
  }

  async getPage(slug: string) {
    const page = await this.pages.findOneBy({
      slug,
      status: PublishStatus.Published,
    });
    if (!page) throw new NotFoundException('Không tìm thấy trang');
    return page;
  }

  /** Published banners/announcements for a placement, honouring the schedule window. */
  listBlocks(placement: string) {
    return this.blocks
      .createQueryBuilder('block')
      .where('block.placement = :placement', { placement })
      .andWhere('block.status = :status', { status: PublishStatus.Published })
      .andWhere('(block.startsAt IS NULL OR block.startsAt <= NOW())')
      .andWhere('(block.endsAt IS NULL OR block.endsAt >= NOW())')
      .orderBy('block.sortOrder', 'ASC')
      .getMany();
  }
}

@ApiTags('content')
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get('posts')
  @ApiOperation({ summary: 'Published blog posts' })
  posts(@Query() query: QueryPostsDto) {
    return this.content.listPosts(query);
  }

  @Public()
  @Get('posts/:slug')
  post(@Param('slug') slug: string) {
    return this.content.getPost(slug);
  }

  @Public()
  @Get('pages/:slug')
  @ApiOperation({ summary: 'Static page (giới thiệu, chính sách…)' })
  page(@Param('slug') slug: string) {
    return this.content.getPage(slug);
  }

  @Public()
  @Get('content-blocks/:placement')
  @ApiOperation({ summary: 'Active banners / announcements for a placement' })
  blocks(@Param('placement') placement: string) {
    return this.content.listBlocks(placement);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Post, PostCategory, Page, ContentBlock])],
  controllers: [ContentController, AdminContentController],
  providers: [ContentService, ContentAdminService],
  exports: [ContentService, ContentAdminService],
})
export class ContentModule {}
