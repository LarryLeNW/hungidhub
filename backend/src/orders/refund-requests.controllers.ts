import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { Role } from '../common/enums/role.enum.js';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import { User } from '../users/entities/user.entity.js';
import {
  CreateRefundRequestDto,
  QueryRefundRequestsDto,
  RejectRefundRequestDto,
  ReviewRefundRequestDto,
} from './dto/refund-request.dto.js';
import { RefundRequestsService } from './refund-requests.service.js';

@ApiTags('refund-requests')
@Controller('refund-requests')
export class RefundRequestsController {
  constructor(private readonly service: RefundRequestsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Gửi yêu cầu hoàn tiền (khách đăng nhập hoặc tra cứu email)' })
  create(
    @Body() dto: CreateRefundRequestDto,
    @CurrentUser() user: User | null,
  ) {
    return this.service.create(dto, user);
  }

  @Public()
  @Get('lookup')
  @ApiOperation({ summary: 'Tra cứu yêu cầu hoàn tiền bằng mã yêu cầu/đơn hàng và email' })
  @ApiQuery({ name: 'code', example: 'AH10428' })
  @ApiQuery({ name: 'email', example: 'khach@example.com' })
  lookup(
    @Query('code') code: string,
    @Query('email') email: string,
  ) {
    return this.service.lookup(code, email);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách yêu cầu hoàn tiền của tôi' })
  mine(
    @CurrentUser('id') userId: number,
    @Query() query: QueryRefundRequestsDto,
  ) {
    return this.service.listMine(userId, query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết yêu cầu hoàn tiền của tôi' })
  mineDetail(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.findMine(userId, id);
  }

  @Post(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy yêu cầu hoàn tiền khi đang chờ duyệt' })
  cancelMine(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.cancelMine(userId, id);
  }
}

@ApiTags('admin/refund-requests')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/refund-requests')
export class AdminRefundRequestsController {
  constructor(private readonly service: RefundRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách yêu cầu hoàn tiền (admin)' })
  list(@Query() query: QueryRefundRequestsDto) {
    return this.service.findAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết yêu cầu hoàn tiền (admin)' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.findByIdAdmin(id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Duyệt và thực hiện hoàn tiền (admin)' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @Body() dto: ReviewRefundRequestDto,
  ) {
    return this.service.approve(id, adminId, dto.adminNote);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Từ chối yêu cầu hoàn tiền (admin)' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @Body() dto: RejectRefundRequestDto,
  ) {
    return this.service.reject(id, adminId, dto.reason);
  }
}
