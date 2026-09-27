import {
  Body,
  Controller,
  Get,
  Ip,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import { User } from '../users/entities/user.entity.js';
import {
  CancelOrderDto,
  CompleteOrderDto,
  ConfirmPaymentDto,
  CreateOrderDto,
  LookupOrderDto,
  QueryOrdersDto,
} from './dto/order.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @ApiOperation({
    summary: 'Checkout (guest or signed in). Returns payment instructions.',
  })
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: User | null,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.orders.create(dto, user, { ip, userAgent });
  }

  @Public()
  @Get('lookup')
  @ApiOperation({ summary: 'Kiểm tra đơn hàng bằng mã đơn + email' })
  lookup(@Query() query: LookupOrderDto) {
    return this.orders.lookup(query.code, query.email);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My orders' })
  mine(@CurrentUser('id') userId: number, @Query() query: QueryOrdersDto) {
    return this.orders.listMine(userId, query);
  }

  @Get('me/:code')
  @ApiBearerAuth()
  mineDetail(@CurrentUser('id') userId: number, @Param('code') code: string) {
    return this.orders.findMine(userId, code.toUpperCase().replace(/^#/, ''));
  }
}

@ApiTags('admin/orders')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() query: QueryOrdersDto) {
    return this.orders.findAdmin(query);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.orders.findAdminById(id);
  }

  @Post(':id/confirm-payment')
  @ApiOperation({
    summary: 'Mark bank/Zalo payment as received (-> processing)',
  })
  confirmPayment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.orders.confirmPayment(id, adminId, dto.transactionRef);
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Deliver from stock / record manual delivery (-> completed)',
  })
  complete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @Body() dto: CompleteOrderDto,
  ) {
    return this.orders.complete(id, adminId, dto.deliveryNotes);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancel(id, adminId, dto.reason);
  }

  @Post(':id/refund')
  refund(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.refund(id, adminId, dto.reason);
  }
}
