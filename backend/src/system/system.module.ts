import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Allow,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { Request } from 'express';
import { Req } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { Role } from '../common/enums/role.enum.js';
import { AuditLog } from './entities/audit-log.entity.js';
import { Notification } from './entities/notification.entity.js';
import { Report } from './entities/report.entity.js';
import { Setting } from './entities/setting.entity.js';
import { NotificationsService } from './notifications.service.js';
import {
  REPORT_KINDS,
  ReportsService,
  type ReportKind,
} from './reports.service.js';
import { SettingsService } from './settings.service.js';
import { StatsService } from './stats.service.js';
import { SettingGroup } from './system.enums.js';
import { AnalyticsService } from './analytics.service.js';

export class TrackPageViewDto {
  @IsString() @MaxLength(64) sessionId: string;
  @IsString() @MaxLength(500) path: string;
  @IsOptional() @IsString() @MaxLength(1000) referrer?: string;
}

export class UpsertSettingDto {
  @ApiProperty({ description: 'Any JSON value' })
  @Allow()
  value: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublic?: boolean;
  @ApiPropertyOptional({ enum: SettingGroup })
  @IsOptional()
  @IsEnum(SettingGroup)
  group?: SettingGroup;
}

export class GenerateReportDto {
  @ApiProperty({ enum: Object.keys(REPORT_KINDS) })
  @IsIn(Object.keys(REPORT_KINDS))
  kind: ReportKind;

  @ApiProperty({ example: '2026-08-01T00:00:00Z' })
  @IsDateString()
  periodStart: string;
  @ApiProperty({ example: '2026-08-31T23:59:59Z' })
  @IsDateString()
  periodEnd: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;
}

@ApiTags('settings')
@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('public')
  @ApiOperation({
    summary: 'Public storefront settings (hotline, Zalo, home sections…)',
  })
  publicSettings() {
    return this.settings.publicMap();
  }
}

@ApiTags('analytics')
@Controller('analytics')
export class PublicAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Public()
  @Post('page-view')
  @HttpCode(HttpStatus.NO_CONTENT)
  async pageView(@Body() dto: TrackPageViewDto, @Req() request: Request) {
    await this.analytics.record({
      ...dto,
      userAgent: request.get('user-agent'),
    });
  }
}

@ApiTags('admin/system')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin')
export class AdminSystemController {
  constructor(
    private readonly stats: StatsService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly reports: ReportsService,
  ) {}

  @Get('stats')
  @ApiOperation({
    summary:
      'Overview numbers, revenue chart, low stock, activity, sidebar badges',
  })
  overview() {
    return this.stats.overview();
  }

  @Get('notifications')
  listNotifications() {
    return this.notifications.listForAdmin();
  }

  @Post('notifications/:id/read')
  markRead(@Param('id', ParseIntPipe) id: number) {
    return this.notifications.markRead(id);
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead() {
    await this.notifications.markAllRead();
  }

  @Get('settings')
  listSettings() {
    return this.settings.findAll();
  }

  @Put('settings/:key')
  upsertSetting(
    @Param('key') key: string,
    @Body() dto: UpsertSettingDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.settings.upsert(key, dto, userId);
  }

  @Get('reports')
  listReports(@Query() query: PaginationQueryDto) {
    return this.reports.findAll(query);
  }

  @Get('reports/kinds')
  reportKinds() {
    return REPORT_KINDS;
  }

  @Get('reports/:id')
  report(@Param('id', ParseIntPipe) id: number) {
    return this.reports.findById(id);
  }

  @Post('reports')
  @ApiOperation({
    summary: 'Generate a report for a period (computed immediately)',
  })
  generateReport(
    @Body() dto: GenerateReportDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.reports.generate(dto, userId);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, Setting, Report, AuditLog]),
  ],
  controllers: [PublicSettingsController, PublicAnalyticsController, AdminSystemController],
  providers: [
    NotificationsService,
    SettingsService,
    StatsService,
    ReportsService,
    AnalyticsService,
  ],
  exports: [NotificationsService, SettingsService],
})
export class SystemModule {}
