import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  @IsString()
  API_PREFIX = 'api';

  @IsString()
  CORS_ORIGIN = 'http://localhost:3000';

  @IsString()
  DB_HOST = 'localhost';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT = 3306;

  @IsString()
  DB_USERNAME = 'root';

  @IsOptional()
  @IsString()
  DB_PASSWORD = '';

  @IsString()
  DB_NAME = 'aihub';

  @Transform(toBoolean)
  @IsBoolean()
  DB_SYNCHRONIZE = false;

  @Transform(toBoolean)
  @IsBoolean()
  DB_LOGGING = false;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN = '15m';

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN = '7d';

  @IsOptional()
  @IsEmail()
  ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  ADMIN_PASSWORD?: string;

  @IsOptional()
  @IsString()
  ADMIN_NAME?: string;

  /** Public base URL used to build links to uploaded files (defaults to http://localhost:PORT). */
  @IsOptional()
  @IsString()
  PUBLIC_URL?: string;

  /** Folder for uploaded media, relative to the backend working directory. */
  @IsOptional()
  @IsString()
  UPLOAD_DIR?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  // Treat empty optional values as "not set" so `.env` templates with blank keys still validate.
  const normalized = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [
      key,
      value === '' && key !== 'DB_PASSWORD' ? undefined : value,
    ]),
  );

  const validated = plainToInstance(EnvironmentVariables, normalized, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }

  return validated;
}
