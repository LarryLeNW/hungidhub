import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Accepts `?x=a&x=b` as well as `?x=a,b`. */
const toList = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === ''
    ? undefined
    : (Array.isArray(value) ? value : String(value).split(','))
        .map((item) => String(item).trim())
        .filter(Boolean);
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { ProductStatus } from '../catalog.enums.js';

export enum ProductSort {
  Newest = 'newest',
  PriceAsc = 'price_asc',
  PriceDesc = 'price_desc',
  BestSelling = 'best_selling',
  Featured = 'featured',
}

export class QueryProductsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Category slug or nested path; includes child categories',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string;

  @ApiPropertyOptional({ description: 'Matches name / short description' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ProductSort, default: ProductSort.Featured })
  @IsOptional()
  @IsEnum(ProductSort)
  sort: ProductSort = ProductSort.Featured;

  @ApiPropertyOptional({
    description: 'Only products carrying this badge, e.g. "Sale"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  badge?: string;

  @ApiPropertyOptional({
    type: [Number],
    description:
      'Explicit ids (keeps the given order); comma-separated or repeated',
  })
  @IsOptional()
  @Transform(toList)
  @Type(() => Number)
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids?: number[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Explicit slugs (keeps the given order); comma-separated or repeated',
  })
  @IsOptional()
  @Transform(toList)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(190, { each: true })
  slugs?: string[];
}

export class QueryAdminProductsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Category id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
}
