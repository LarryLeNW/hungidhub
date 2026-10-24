import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSeedService } from './admin-seed.service.js';
import { User } from './entities/user.entity.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UsersExcelService } from './users-excel.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, AdminSeedService, UsersExcelService],
  exports: [UsersService, UsersExcelService],
})
export class UsersModule {}
