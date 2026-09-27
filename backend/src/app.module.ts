import {
  BadRequestException,
  ClassSerializerInterceptor,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import type { ValidationError } from 'class-validator';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { validateEnv } from './config/env.validation.js';
import { ContentModule } from './content/content.module.js';
import { DatabaseModule } from './database/database.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { WpImportModule } from './import/wp-import.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PromotionsModule } from './promotions/promotions.module.js';
import { SupportModule } from './support/support.module.js';
import { SystemModule } from './system/system.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { UsersModule } from './users/users.module.js';

function validationErrorPaths(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const childPaths = validationErrorPaths(error.children ?? [], path);
    return childPaths.length ? childPaths : [path];
  });
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    PromotionsModule,
    FinanceModule,
    OrdersModule,
    ContentModule,
    SupportModule,
    SystemModule,
    UploadsModule,
    WpImportModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
        exceptionFactory: (errors) =>
          new BadRequestException(
            `Dữ liệu không hợp lệ: ${[...new Set(validationErrorPaths(errors))].join(', ')}`,
          ),
      }),
    },
    // Lỗi DB/bất ngờ → HTTP chuẩn + tiếng Việt, không lộ chi tiết SQL ra client.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Strips @Exclude() fields (password/refresh hashes) from every response.
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    // Order matters: authenticate first, then authorize.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
