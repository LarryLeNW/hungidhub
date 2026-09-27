import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DeliveryType, ProductStatus, StockStatus } from '../catalog.enums.js';

const PUBLIC_IMAGE_URL = /^(?:https?:\/\/\S+|\/uploads\/\S+)$/i;
const PUBLIC_IMAGE_URL_MESSAGE =
  'image must be an http(s) URL or a site-relative /uploads/ path';

export class ProductImageInputDto {
  @ApiProperty()
  @Matches(PUBLIC_IMAGE_URL, { message: PUBLIC_IMAGE_URL_MESSAGE })
  @MaxLength(500)
  src: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt?: string;
}

export class CreateVariantDto {
  @ApiPropertyOptional({ description: 'Defaults to an auto-generated SKU' })
  @IsOptional()
  @Matches(/^[A-Z0-9][A-Z0-9-_.]{1,63}$/i, {
    message: 'sku may contain letters, digits, - _ .',
  })
  sku?: string;

  @ApiProperty({ example: 'Dùng chung - Plus · 1 tháng' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'Dùng chung - Plus' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountType?: string;

  @ApiPropertyOptional({ example: '1 tháng' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  duration?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @ApiProperty({ example: 149000 })
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 299000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  regularPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ enum: StockStatus })
  @IsOptional()
  @IsEnum(StockStatus)
  stockStatus?: StockStatus;

  @ApiPropertyOptional({ enum: DeliveryType })
  @IsOptional()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateVariantDto extends PartialType(CreateVariantDto) {}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Defaults to a slug generated from the name',
  })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case',
  })
  @MaxLength(190)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentHtml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PUBLIC_IMAGE_URL, { message: PUBLIC_IMAGE_URL_MESSAGE })
  @MaxLength(500)
  featuredImage?: string;

  @ApiPropertyOptional({ type: [String], example: ['Sale'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  badges?: string[];

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.Draft })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoryIds?: number[];

  @ApiPropertyOptional({ type: [ProductImageInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  images?: ProductImageInputDto[];

  @ApiPropertyOptional({ type: [CreateVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deliveryTimeText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
