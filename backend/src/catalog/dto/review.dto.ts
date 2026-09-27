import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ReviewStatus } from '../catalog.enums.js';

export class CreateReviewDto {
  @ApiProperty({ example: 'Minh' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  authorName: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ example: 'Nhận tài khoản nhanh, dùng ổn định.' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  content: string;
}

export class UpdateReviewStatusDto {
  @ApiProperty({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  status: ReviewStatus;
}
