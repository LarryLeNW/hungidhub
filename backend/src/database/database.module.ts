import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentVariables } from '../config/env.validation.js';
import { ALL_ENTITIES } from './entities.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        type: 'mysql',
        host: config.get('DB_HOST', { infer: true }),
        port: config.get('DB_PORT', { infer: true }),
        username: config.get('DB_USERNAME', { infer: true }),
        password: config.get('DB_PASSWORD', { infer: true }),
        database: config.get('DB_NAME', { infer: true }),
        charset: 'utf8mb4_unicode_ci',
        timezone: 'Z',
        entities: ALL_ENTITIES,
        autoLoadEntities: true,
        synchronize: config.get('DB_SYNCHRONIZE', { infer: true }),
        logging: config.get('DB_LOGGING', { infer: true }),
      }),
    }),
  ],
})
export class DatabaseModule {}
