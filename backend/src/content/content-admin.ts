import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
  PartialType,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { In, Repository } from 'typeorm';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { Role } from '../common/enums/role.enum.js';
import { paginate } from '../common/utils/pagination.js';
import { slugify } from '../common/utils/slug.js';
import {
  ContentBlockType,
  ContentPlacement,
  PublishStatus,
} from './content.enums.js';
import { ContentBlock } from './entities/content-block.entity.js';
import { Page } from './entities/page.entity.js';
import { Post as BlogPost } from './entities/post.entity.js';
import { PostCategory } from './entities/post-category.entity.js';

// ------------------------------------------------------------------------ DTOs

export class CreateContentBlockDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(255) title: string;
  @ApiProperty({ enum: ContentBlockType })
  @IsEnum(ContentBlockType)
  type: ContentBlockType;
  @ApiPropertyOptional({ enum: ContentPlacement })
  @IsOptional()
  @IsEnum(ContentPlacement)
  placement?: ContentPlacement;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(?:https?:\/\/\S+|\/uploads\/\S+)$/i, {
    message: 'imageUrl must be an http(s) URL or a site-relative /uploads/ path',
  })
  @MaxLength(500)
  imageUrl?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(?:https?:\/\/\S+|\/uploads\/\S+)$/i, {
    message: 'mobileImageUrl must be an http(s) URL or a site-relative /uploads/ path',
  })
  @MaxLength(500)
  mobileImageUrl?: string;
  @ApiPropertyOptional({ description: 'Absolute or site-relative link' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional({ enum: PublishStatus })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endsAt?: string;
}

export class UpdateContentBlockDto extends PartialType(CreateContentBlockDto) {}

export class CreatePostDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(255) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(190) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() excerpt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contentHtml?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) featuredImage?: string;
  @ApiPropertyOptional({ enum: PublishStatus }) @IsOptional() @IsEnum(PublishStatus) status?: PublishStatus;
  @ApiPropertyOptional({ type: [Number] }) @IsOptional() @IsArray() @ArrayUnique() @IsInt({ each: true }) categoryIds?: number[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) seoTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) seoDescription?: string;
}

export class UpdatePostDto extends PartialType(CreatePostDto) {}

export class QueryContentDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PublishStatus })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

/** The hero/sale banners the storefront used to hard-code; seeded once so admins can manage them. */
const DEFAULT_BANNERS: Partial<ContentBlock>[] = [
  {
    title: 'ChatGPT Plus',
    placement: ContentPlacement.Home,
    imageUrl:
      'https://khotaikhoan.net/wp-content/uploads/2026/05/chatgpt-plus-banner.webp',
    linkUrl: '/tai-khoan-chatgpt-plus',
    sortOrder: 0,
  },
  {
    title: 'Claude AI Pro Max',
    placement: ContentPlacement.Home,
    imageUrl:
      'https://khotaikhoan.net/wp-content/uploads/2026/05/claude-ai-pro-max-banner.webp',
    linkUrl: '/tai-khoan-claude-ai',
    sortOrder: 1,
  },
  {
    title: 'Google AI Pro',
    placement: ContentPlacement.Home,
    imageUrl:
      'https://khotaikhoan.net/wp-content/uploads/2026/05/google-ai-pro-banner.webp',
    linkUrl: '/tai-khoan-google-ai-pro',
    sortOrder: 2,
  },
  {
    title: 'Mega Sale',
    placement: ContentPlacement.Home,
    imageUrl:
      'https://khotaikhoan.net/wp-content/uploads/2026/07/mega-sale-banner-20260720.jpg',
    linkUrl: '/ung-dung-phan-mem-khac/cong-cu-ai',
    sortOrder: 3,
  },
  {
    title: 'Flash Sale',
    placement: ContentPlacement.Home,
    imageUrl:
      'https://khotaikhoan.net/wp-content/uploads/2026/06/Sale-banner3.jpg',
    linkUrl: '/ung-dung-phan-mem-khac/cong-cu-ai',
    sortOrder: 4,
  },
];

// --------------------------------------------------------------------- service

@Injectable()
export class ContentAdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ContentAdminService.name);

  constructor(
    @InjectRepository(ContentBlock)
    private readonly blocks: Repository<ContentBlock>,
    @InjectRepository(BlogPost) private readonly posts: Repository<BlogPost>,
    @InjectRepository(PostCategory)
    private readonly postCategories: Repository<PostCategory>,
    @InjectRepository(Page) private readonly pages: Repository<Page>,
  ) {}

  async onApplicationBootstrap() {
    if ((await this.blocks.count()) === 0) {
      await this.blocks.save(
        DEFAULT_BANNERS.map((banner) =>
          this.blocks.create({
            ...banner,
            type: ContentBlockType.Banner,
            status: PublishStatus.Published,
            publishedAt: new Date(),
          }),
        ),
      );
      this.logger.log(`Seeded ${DEFAULT_BANNERS.length} home banners`);
    }
  }

  async listBlocks(query: QueryContentDto) {
    const qb = this.blocks
      .createQueryBuilder('block')
      .leftJoinAndSelect('block.updatedBy', 'updatedBy')
      .orderBy('block.placement', 'ASC')
      .addOrderBy('block.sortOrder', 'ASC');
    if (query.status)
      qb.andWhere('block.status = :status', { status: query.status });
    if (query.search)
      qb.andWhere('block.title LIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    const [items, total] = await qb
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();
    return paginate(items, total, query);
  }

  async createBlock(dto: CreateContentBlockDto, userId: number) {
    return this.blocks.save(
      this.blocks.create({
        title: dto.title,
        type: dto.type,
        placement: dto.placement ?? ContentPlacement.Home,
        body: dto.body ?? null,
        imageUrl: dto.imageUrl ?? null,
        mobileImageUrl: dto.mobileImageUrl ?? null,
        linkUrl: dto.linkUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? PublishStatus.Draft,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        publishedAt: dto.status === PublishStatus.Published ? new Date() : null,
        updatedById: userId,
      }),
    );
  }

  async updateBlock(id: number, dto: UpdateContentBlockDto, userId: number) {
    const block = await this.blocks.findOneBy({ id });
    if (!block) throw new NotFoundException(`Không tìm thấy khối nội dung #${id}`);
    const { startsAt, endsAt, ...rest } = dto;
    Object.assign(block, rest, {
      ...(startsAt !== undefined
        ? { startsAt: startsAt ? new Date(startsAt) : null }
        : {}),
      ...(endsAt !== undefined
        ? { endsAt: endsAt ? new Date(endsAt) : null }
        : {}),
      updatedById: userId,
    });
    if (dto.status === PublishStatus.Published && !block.publishedAt)
      block.publishedAt = new Date();
    return this.blocks.save(block);
  }

  async removeBlock(id: number) {
    const block = await this.blocks.findOneBy({ id });
    if (!block) throw new NotFoundException(`Không tìm thấy khối nội dung #${id}`);
    await this.blocks.softDelete({ id });
  }

  async listPosts(query: QueryContentDto) {
    const qb = this.posts
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.categories', 'category')
      .orderBy('post.updatedAt', 'DESC');
    if (query.status)
      qb.andWhere('post.status = :status', { status: query.status });
    if (query.search)
      qb.andWhere('post.title LIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    const [items, total] = await qb
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();
    return paginate(
      items.map((post) => ({ ...post, contentHtml: undefined })),
      total,
      query,
    );
  }

  getPost(id: number) {
    return this.posts.findOne({ where: { id }, relations: { author: true, categories: true } }).then((post) => {
      if (!post) throw new NotFoundException(`Không tìm thấy bài viết #${id}`);
      return post;
    });
  }

  listPostCategories() {
    return this.postCategories.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  private async postSlug(value: string, excludeId?: number) {
    const slug = slugify(value);
    if (!slug) throw new ConflictException('Đường dẫn bài viết không hợp lệ.');
    const existing = await this.posts.findOneBy({ slug });
    if (existing && existing.id !== excludeId) throw new ConflictException('Đường dẫn bài viết đã tồn tại.');
    return slug;
  }

  async createPost(dto: CreatePostDto, userId: number) {
    const status = dto.status ?? PublishStatus.Draft;
    const categories = dto.categoryIds?.length
      ? await this.postCategories.findBy({ id: In(dto.categoryIds) })
      : [];
    return this.posts.save(this.posts.create({
      title: dto.title.trim(),
      slug: await this.postSlug(dto.slug?.trim() || dto.title),
      excerpt: dto.excerpt?.trim() || null,
      contentHtml: dto.contentHtml?.trim() || null,
      featuredImage: dto.featuredImage?.trim() || null,
      status,
      authorId: userId,
      publishedAt: status === PublishStatus.Published ? new Date() : null,
      seoTitle: dto.seoTitle?.trim() || null,
      seoDescription: dto.seoDescription?.trim() || null,
      categories,
    }));
  }

  async updatePost(id: number, dto: UpdatePostDto) {
    const post = await this.getPost(id);
    if (dto.title !== undefined) post.title = dto.title.trim();
    if (dto.slug !== undefined) post.slug = await this.postSlug(dto.slug.trim() || post.title, id);
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt.trim() || null;
    if (dto.contentHtml !== undefined) post.contentHtml = dto.contentHtml.trim() || null;
    if (dto.featuredImage !== undefined) post.featuredImage = dto.featuredImage.trim() || null;
    if (dto.seoTitle !== undefined) post.seoTitle = dto.seoTitle.trim() || null;
    if (dto.seoDescription !== undefined) post.seoDescription = dto.seoDescription.trim() || null;
    if (dto.categoryIds !== undefined) post.categories = dto.categoryIds.length
      ? await this.postCategories.findBy({ id: In(dto.categoryIds) })
      : [];
    if (dto.status !== undefined) {
      post.status = dto.status;
      if (dto.status === PublishStatus.Published && !post.publishedAt) post.publishedAt = new Date();
    }
    return this.posts.save(post);
  }

  async removePost(id: number) {
    if (!(await this.posts.existsBy({ id }))) throw new NotFoundException(`Không tìm thấy bài viết #${id}`);
    await this.posts.delete({ id });
  }

  async listPages(query: QueryContentDto) {
    const qb = this.pages
      .createQueryBuilder('page')
      .leftJoinAndSelect('page.updatedBy', 'updatedBy')
      .orderBy('page.updatedAt', 'DESC');
    if (query.status)
      qb.andWhere('page.status = :status', { status: query.status });
    if (query.search)
      qb.andWhere('page.title LIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    const [items, total] = await qb
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();
    return paginate(
      items.map((page) => ({ ...page, contentHtml: undefined })),
      total,
      query,
    );
  }

  async setPostStatus(id: number, status: PublishStatus) {
    const post = await this.posts.findOneBy({ id });
    if (!post) throw new NotFoundException(`Không tìm thấy bài viết #${id}`);
    post.status = status;
    if (status === PublishStatus.Published && !post.publishedAt)
      post.publishedAt = new Date();
    return this.posts.save(post);
  }

  async setPageStatus(id: number, status: PublishStatus, userId: number) {
    const page = await this.pages.findOneBy({ id });
    if (!page) throw new NotFoundException(`Không tìm thấy trang #${id}`);
    page.status = status;
    page.updatedById = userId;
    if (status === PublishStatus.Published && !page.publishedAt)
      page.publishedAt = new Date();
    return this.pages.save(page);
  }
}

// ------------------------------------------------------------------ controller

@ApiTags('admin/content')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly content: ContentAdminService) {}

  @Get('blocks')
  @ApiOperation({ summary: 'Banners, announcements, help articles' })
  listBlocks(@Query() query: QueryContentDto) {
    return this.content.listBlocks(query);
  }

  @Post('blocks')
  createBlock(
    @Body() dto: CreateContentBlockDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.content.createBlock(dto, userId);
  }

  @Patch('blocks/:id')
  updateBlock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContentBlockDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.content.updateBlock(id, dto, userId);
  }

  @Delete('blocks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeBlock(@Param('id', ParseIntPipe) id: number) {
    await this.content.removeBlock(id);
  }

  @Get('posts')
  listPosts(@Query() query: QueryContentDto) {
    return this.content.listPosts(query);
  }

  @Get('posts/categories')
  listPostCategories() {
    return this.content.listPostCategories();
  }

  @Get('posts/:id')
  getPost(@Param('id', ParseIntPipe) id: number) {
    return this.content.getPost(id);
  }

  @Post('posts')
  createPost(@Body() dto: CreatePostDto, @CurrentUser('id') userId: number) {
    return this.content.createPost(dto, userId);
  }

  @Patch('posts/:id')
  updatePost(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePostDto) {
    return this.content.updatePost(id, dto);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePost(@Param('id', ParseIntPipe) id: number) {
    await this.content.removePost(id);
  }

  @Patch('posts/:id/status/:status')
  @ApiQuery({ name: 'status', enum: PublishStatus })
  setPostStatus(
    @Param('id', ParseIntPipe) id: number,
    @Param('status') status: PublishStatus,
  ) {
    return this.content.setPostStatus(id, status);
  }

  @Get('pages')
  listPages(@Query() query: QueryContentDto) {
    return this.content.listPages(query);
  }

  @Patch('pages/:id/status/:status')
  setPageStatus(
    @Param('id', ParseIntPipe) id: number,
    @Param('status') status: PublishStatus,
    @CurrentUser('id') userId: number,
  ) {
    return this.content.setPageStatus(id, status, userId);
  }
}
