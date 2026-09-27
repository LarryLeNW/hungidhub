import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseIntPipe,
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
} from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { Role } from '../common/enums/role.enum.js';
import { SearchQueryDto } from '../common/dto/search-query.dto.js';
import { SystemModule } from '../system/system.module.js';
import { FundRequest } from './entities/fund-request.entity.js';
import { WalletTransaction } from './entities/wallet-transaction.entity.js';
import { Wallet } from './entities/wallet.entity.js';
import {
  FundRequestStatus,
  FundRequestType,
  WalletTransactionStatus,
  WalletTransactionType,
} from './finance.enums.js';
import { WalletsService } from './wallets.service.js';

export class CreateFundRequestDto {
  @ApiProperty({ enum: FundRequestType })
  @IsEnum(FundRequestType)
  type: FundRequestType;

  @ApiProperty({ example: 500000, minimum: 10000 })
  @IsInt()
  @Min(10_000)
  @Max(500_000_000)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bankAccountNumber?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class ReviewFundRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  note?: string;
}

export class RejectFundRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  reason: string;
}

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallets: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'My AIHUB balance' })
  me(@CurrentUser('id') userId: number) {
    return this.wallets.getMine(userId);
  }

  @Get('transactions')
  transactions(
    @CurrentUser('id') userId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.wallets.listMyTransactions(userId, query);
  }

  @Get('fund-requests')
  myFundRequests(
    @CurrentUser('id') userId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.wallets.listFundRequests(query, { userId });
  }

  @Post('fund-requests')
  @ApiOperation({
    summary: 'Request a deposit (returns transfer memo) or a withdrawal',
  })
  createFundRequest(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateFundRequestDto,
  ) {
    return this.wallets.createFundRequest(userId, dto);
  }
}

@ApiTags('admin/finance')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/fund-requests')
export class AdminFundRequestsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get()
  @ApiQuery({ name: 'status', enum: FundRequestStatus, required: false })
  list(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: FundRequestStatus,
  ) {
    return this.wallets.listFundRequests(query, status ? { status } : {});
  }

  @Post(':id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') reviewerId: number,
    @Body() dto: ReviewFundRequestDto,
  ) {
    return this.wallets.approveFundRequest(id, reviewerId, dto.note);
  }

  @Post(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') reviewerId: number,
    @Body() dto: RejectFundRequestDto,
  ) {
    return this.wallets.rejectFundRequest(id, reviewerId, dto.reason);
  }
}

@ApiTags('admin/finance')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/transactions')
export class AdminTransactionsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'Giao dịch: wallet ledger across all users' })
  @ApiQuery({ name: 'type', enum: WalletTransactionType, required: false })
  @ApiQuery({ name: 'status', enum: WalletTransactionStatus, required: false })
  list(
    @Query() query: SearchQueryDto,
    @Query('type') type?: WalletTransactionType,
    @Query('status') status?: WalletTransactionStatus,
  ) {
    return this.wallets.listTransactionsAdmin(query, {
      type,
      status,
      search: query.search,
    });
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WalletTransaction, FundRequest]),
    SystemModule,
  ],
  controllers: [
    WalletController,
    AdminFundRequestsController,
    AdminTransactionsController,
  ],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class FinanceModule {}
