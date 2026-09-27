import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
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
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { Role } from '../common/enums/role.enum.js';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import { assignCode, placeholderCode } from '../common/utils/codes.js';
import { paginate } from '../common/utils/pagination.js';
import { Order } from '../orders/entities/order.entity.js';
import { NotificationsService } from '../system/notifications.service.js';
import { SystemModule } from '../system/system.module.js';
import {
  NotificationSection,
  NotificationTone,
} from '../system/system.enums.js';
import { User } from '../users/entities/user.entity.js';
import { SupportMessage } from './entities/support-message.entity.js';
import { SupportTicket } from './entities/support-ticket.entity.js';
import {
  TicketAuthorType,
  TicketPriority,
  TicketStatus,
} from './support.enums.js';

// ------------------------------------------------------------------------ DTOs

export class CreateTicketDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) customerName: string;
  @ApiProperty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  customerEmail: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(255) subject: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(4000) message: string;
  @ApiPropertyOptional({ example: 'AH10001' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase().replace(/^#/, '')
      : value,
  )
  @IsString()
  @MaxLength(20)
  orderCode?: string;
  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}

export class ReplyTicketDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000) body: string;
  @ApiPropertyOptional({
    description: 'Staff-only note hidden from the customer',
  })
  @IsOptional()
  isInternal?: boolean;
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
  @ApiPropertyOptional({ description: 'Admin user id; null to unassign' })
  @IsOptional()
  @IsInt()
  assigneeId?: number | null;
}

export class QueryTicketsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

// --------------------------------------------------------------------- service

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly tickets: Repository<SupportTicket>,
    @InjectRepository(SupportMessage)
    private readonly messages: Repository<SupportMessage>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateTicketDto, user: User | null) {
    const order = dto.orderCode
      ? await this.orders.findOneBy({ code: dto.orderCode })
      : null;
    if (dto.orderCode && !order) {
      throw new NotFoundException(`Không tìm thấy đơn ${dto.orderCode}`);
    }

    const ticket = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(SupportTicket, {
          code: placeholderCode(),
          userId: user?.id ?? null,
          customerName: dto.customerName.trim(),
          customerEmail: dto.customerEmail,
          subject: dto.subject.trim(),
          orderId: order?.id ?? null,
          priority: dto.priority ?? TicketPriority.Medium,
          status: TicketStatus.New,
          lastMessageAt: new Date(),
        }),
      );
      created.code = await assignCode(
        manager,
        SupportTicket,
        created.id,
        'TK-',
        9000,
      );
      await manager.save(
        manager.create(SupportMessage, {
          ticketId: created.id,
          authorId: user?.id ?? null,
          authorType: TicketAuthorType.Customer,
          body: dto.message.trim(),
          isInternal: false,
        }),
      );
      return created;
    });

    await this.notifications.notifyAdmins({
      title: `Phiếu hỗ trợ mới ${ticket.code}`,
      body: ticket.subject,
      section: NotificationSection.Support,
      tone:
        ticket.priority === TicketPriority.High
          ? NotificationTone.Danger
          : NotificationTone.Amber,
      entityType: 'support_ticket',
      entityId: ticket.id,
    });
    return this.findById(ticket.id);
  }

  async listMine(userId: number, query: PaginationQueryDto) {
    const [items, total] = await this.tickets.findAndCount({
      where: { userId },
      order: { id: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  async findMine(userId: number, id: number) {
    const ticket = await this.findById(id);
    if (ticket.userId !== userId) throw new ForbiddenException('Bạn không có quyền thao tác trên phiếu hỗ trợ này');
    ticket.messages = ticket.messages.filter((message) => !message.isInternal);
    return ticket;
  }

  async findById(id: number) {
    const ticket = await this.tickets.findOne({
      where: { id },
      relations: {
        messages: { author: true },
        user: true,
        assignee: true,
        order: true,
      },
      order: { messages: { id: 'ASC' } },
    });
    if (!ticket) throw new NotFoundException(`Không tìm thấy phiếu hỗ trợ #${id}`);
    return ticket;
  }

  async listAdmin(query: QueryTicketsDto) {
    const qb = this.tickets
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.assignee', 'assignee')
      .orderBy('ticket.updatedAt', 'DESC');
    if (query.status)
      qb.andWhere('ticket.status = :status', { status: query.status });
    if (query.search) {
      qb.andWhere(
        '(ticket.code LIKE :search OR ticket.subject LIKE :search OR ticket.customerName LIKE :search OR ticket.customerEmail LIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }
    const [items, total] = await qb
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();
    return paginate(items, total, query);
  }

  async reply(
    ticketId: number,
    dto: ReplyTicketDto,
    author: User,
    asStaff: boolean,
  ) {
    const ticket = await this.findById(ticketId);
    if (!asStaff && ticket.userId !== author.id) throw new ForbiddenException('Bạn không có quyền thao tác trên phiếu hỗ trợ này');

    await this.messages.save(
      this.messages.create({
        ticketId,
        authorId: author.id,
        authorType: asStaff
          ? TicketAuthorType.Staff
          : TicketAuthorType.Customer,
        body: dto.body.trim(),
        isInternal: asStaff ? Boolean(dto.isInternal) : false,
      }),
    );
    ticket.lastMessageAt = new Date();
    if (asStaff && !dto.isInternal && ticket.status !== TicketStatus.Closed) {
      ticket.status = TicketStatus.WaitingCustomer;
    } else if (!asStaff && ticket.status !== TicketStatus.Closed) {
      ticket.status = TicketStatus.InProgress;
    }
    // `update` (not `save`) so the loaded `messages` array is never treated as the full set.
    await this.tickets.update(
      { id: ticketId },
      { lastMessageAt: ticket.lastMessageAt, status: ticket.status },
    );
    return this.findById(ticketId);
  }

  async update(id: number, dto: UpdateTicketDto) {
    const ticket = await this.findById(id);
    if (dto.status) {
      ticket.status = dto.status;
      if (dto.status === TicketStatus.Resolved) ticket.resolvedAt = new Date();
      if (dto.status === TicketStatus.Closed) ticket.closedAt = new Date();
    }
    if (dto.priority) ticket.priority = dto.priority;
    if (dto.assigneeId !== undefined) ticket.assigneeId = dto.assigneeId;
    await this.tickets.update(
      { id },
      {
        status: ticket.status,
        priority: ticket.priority,
        assigneeId: ticket.assigneeId,
        resolvedAt: ticket.resolvedAt,
        closedAt: ticket.closedAt,
      },
    );
    return this.findById(id);
  }
}

// ------------------------------------------------------------------ controllers

@ApiTags('support')
@Controller('support/tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Open a support ticket (guest or signed in)' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: User | null) {
    return this.support.create(dto, user);
  }

  @Get()
  @ApiBearerAuth()
  mine(@CurrentUser('id') userId: number, @Query() query: PaginationQueryDto) {
    return this.support.listMine(userId, query);
  }

  @Get(':id')
  @ApiBearerAuth()
  mineDetail(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.support.findMine(userId, id);
  }

  @Post(':id/messages')
  @ApiBearerAuth()
  reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.support.reply(id, dto, user, false);
  }
}

@ApiTags('admin/support')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/support/tickets')
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @ApiQuery({ name: 'status', enum: TicketStatus, required: false })
  list(@Query() query: QueryTicketsDto) {
    return this.support.listAdmin(query);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.support.findById(id);
  }

  @Post(':id/messages')
  reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.support.reply(id, dto, user, true);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTicketDto) {
    return this.support.update(id, dto);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportTicket, SupportMessage, Order]),
    SystemModule,
  ],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
