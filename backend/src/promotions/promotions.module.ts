import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { Role } from '../common/enums/role.enum.js';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto.js';
import { PromotionUsage } from './entities/promotion-usage.entity.js';
import { Promotion } from './entities/promotion.entity.js';
import { PromotionsService } from './promotions.service.js';

@ApiTags('admin/promotions')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/promotions')
export class AdminPromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.promotions.findAll(query);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.promotions.findById(id);
  }

  @Post()
  create(@Body() dto: CreatePromotionDto, @CurrentUser('id') userId: number) {
    return this.promotions.create(dto, userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotions.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.promotions.remove(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Promotion, PromotionUsage])],
  controllers: [AdminPromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
