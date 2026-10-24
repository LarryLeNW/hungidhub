import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RefundMethod, RefundRequestStatus } from '../orders.enums.js';

export class CreateRefundRequestDto {
  @ApiProperty({ description: 'Mã đơn hàng, ví dụ: AH10428 hoặc #AH10428' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  orderCode: string;

  @ApiPropertyOptional({ description: 'Email đặt hàng (bắt buộc với khách chưa đăng nhập)' })
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  customerEmail?: string;

  @ApiProperty({ description: 'Lý do hoàn tiền' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  reason: string;

  @ApiPropertyOptional({ description: 'Chi tiết vấn đề gặp phải' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: RefundMethod, default: RefundMethod.Wallet })
  @IsOptional()
  @IsEnum(RefundMethod)
  refundMethod?: RefundMethod;

  @ApiPropertyOptional({ description: 'Tên ngân hàng (nếu nhận qua STK)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @ApiPropertyOptional({ description: 'Số tài khoản ngân hàng' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bankAccountNumber?: string;

  @ApiPropertyOptional({ description: 'Tên chủ tài khoản ngân hàng' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountName?: string;

  @ApiPropertyOptional({ description: 'Ảnh chụp màn hình lỗi / bằng chứng' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  proofImageUrl?: string;
}

export class ReviewRefundRequestDto {
  @ApiPropertyOptional({ description: 'Ghi chú duyệt hoàn tiền' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  adminNote?: string;
}

export class RejectRefundRequestDto {
  @ApiProperty({ description: 'Lý do từ chối yêu cầu hoàn tiền' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  reason: string;
}

export class QueryRefundRequestsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Tìm theo mã YC, mã đơn, email, tên khách' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: RefundRequestStatus })
  @IsOptional()
  @IsEnum(RefundRequestStatus)
  status?: RefundRequestStatus;
}
