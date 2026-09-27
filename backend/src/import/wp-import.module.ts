import { Body, Controller, Module, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Category } from '../catalog/entities/category.entity.js';
import { ProductVariant } from '../catalog/entities/product-variant.entity.js';
import { Product } from '../catalog/entities/product.entity.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { Page } from '../content/entities/page.entity.js';
import { Post as BlogPost } from '../content/entities/post.entity.js';
import { WpImportService } from './wp-import.service.js';

export const DEFAULT_WP_CONTENT_PATH = '../src/data/generated/wp-content.json';

export class RunWpImportDto {
  @ApiPropertyOptional({
    description: 'Path to wp-content.json (relative to the backend cwd)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;
}

@ApiTags('admin/import')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/import')
export class AdminImportController {
  constructor(private readonly importer: WpImportService) {}

  @Post('wp')
  @ApiOperation({
    summary:
      'Import categories/products/posts/pages from the WordPress sync JSON',
  })
  run(@Body() dto: RunWpImportDto) {
    return this.importer.importFromFile(dto.path ?? DEFAULT_WP_CONTENT_PATH);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Category,
      Product,
      ProductVariant,
      BlogPost,
      Page,
    ]),
  ],
  controllers: [AdminImportController],
  providers: [WpImportService],
  exports: [WpImportService],
})
export class WpImportModule {}
