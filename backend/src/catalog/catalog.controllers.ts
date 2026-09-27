import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { SearchQueryDto } from '../common/dto/search-query.dto.js';
import { Role } from '../common/enums/role.enum.js';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import { User } from '../users/entities/user.entity.js';
import {
  InventoryItemStatus,
  ProductStatus,
  ReviewStatus,
} from './catalog.enums.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { ImportInventoryDto } from './dto/inventory.dto.js';
import { CreateReviewDto, UpdateReviewStatusDto } from './dto/review.dto.js';
import { ReviewsService } from './reviews.service.js';
import {
  CreateProductDto,
  CreateVariantDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/product.dto.js';
import {
  QueryAdminProductsDto,
  QueryProductsDto,
} from './dto/query-products.dto.js';
import { InventoryService } from './inventory.service.js';
import { ProductsService } from './products.service.js';

// ------------------------------------------------------------------ storefront

@ApiTags('catalog')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Visible category tree (header menu)' })
  tree() {
    return this.categories.findTree();
  }

  @Public()
  @Get('lookup')
  @ApiOperation({ summary: 'Category by slug or nested path' })
  @ApiQuery({ name: 'path', example: 'ung-dung-phan-mem-khac/cong-cu-ai' })
  lookup(@Query('path') path: string) {
    return this.categories.findBySlugOrPath(path ?? '');
  }
}

@ApiTags('catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Active products with enabled variants (filter, search, sort)',
  })
  list(@Query() query: QueryProductsDto) {
    return this.products.findPublic(query);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Product detail by slug' })
  detail(@Param('slug') slug: string) {
    return this.products.findPublicBySlug(slug);
  }
}

// ----------------------------------------------------------------------- admin

@ApiTags('admin/catalog')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary: 'Full category tree incl. hidden, with product counts',
  })
  tree() {
    return this.categories.findTree(true, true);
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.categories.remove(id);
  }
}

@ApiTags('admin/catalog')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'All products (any status) with per-variant stock' })
  list(@Query() query: QueryAdminProductsDto) {
    return this.products.findAdmin(query);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.products.findAdminById(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Patch(':id/status/:status')
  @ApiOperation({ summary: 'Quick publish / hide' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Param('status') status: ProductStatus,
  ) {
    return this.products.updateStatus(id, status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.products.remove(id);
  }

  @Post(':id/variants')
  addVariant(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateVariantDto,
  ) {
    return this.products.addVariant(id, dto);
  }
}

@ApiTags('admin/catalog')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/variants')
export class AdminVariantsController {
  constructor(
    private readonly products: ProductsService,
    private readonly inventory: InventoryService,
  ) {}

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVariantDto) {
    return this.products.updateVariant(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.products.removeVariant(id);
  }

  @Post(':id/inventory')
  @ApiOperation({
    summary: 'Nhập kho: add deliverable units (credentials/keys) to a SKU',
  })
  importInventory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ImportInventoryDto,
    @CurrentUser('id') actorId: number,
  ) {
    return this.inventory.importItems(id, dto.items, actorId, dto.note);
  }

  @Get(':id/inventory')
  @ApiQuery({ name: 'status', enum: InventoryItemStatus, required: false })
  listInventory(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
    @Query('status') status?: InventoryItemStatus,
  ) {
    return this.inventory.listItems(id, query, status);
  }

  @Get(':id/inventory/movements')
  listMovements(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.inventory.listMovements(id, query);
  }
}

@ApiTags('admin/catalog')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Kho hàng: every SKU with available/reserved counts',
  })
  list(@Query() query: SearchQueryDto) {
    return this.inventory.listVariantsWithStock(query);
  }

  @Post('items/:id/revoke')
  @ApiOperation({ summary: 'Remove a bad unit from stock' })
  revoke(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') actorId: number,
    @Body('note') note?: string,
  ) {
    return this.inventory.revokeItem(id, actorId, note);
  }
}

// --------------------------------------------------------------------- reviews

@ApiTags('catalog')
@Controller('products/:slug/reviews')
export class ProductReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Approved reviews + rating summary' })
  @ApiQuery({ name: 'rating', required: false, description: '1-5 filter' })
  list(
    @Param('slug') slug: string,
    @Query() query: PaginationQueryDto,
    @Query('rating') rating?: string,
  ) {
    const parsed = rating ? Number(rating) : undefined;
    return this.reviews.listApproved(
      slug,
      query,
      parsed && parsed >= 1 && parsed <= 5 ? parsed : undefined,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Submit a review (held for moderation)' })
  create(
    @Param('slug') slug: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: User | null,
  ) {
    return this.reviews.create(slug, dto, user?.id ?? null);
  }
}

@ApiTags('admin/catalog')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiQuery({ name: 'status', enum: ReviewStatus, required: false })
  list(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: ReviewStatus,
  ) {
    return this.reviews.listAdmin(query, status);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviews.setStatus(id, dto.status);
  }
}
