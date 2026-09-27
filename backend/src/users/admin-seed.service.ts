import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { Role } from '../common/enums/role.enum.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { UsersService } from './users.service.js';

export const PASSWORD_SALT_ROUNDS = 12;

/** Creates the first admin account from ADMIN_EMAIL / ADMIN_PASSWORD if it does not exist yet. */
@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly usersService: UsersService,
  ) {}

  async onApplicationBootstrap() {
    const email = this.config.get('ADMIN_EMAIL', { infer: true });
    const password = this.config.get('ADMIN_PASSWORD', { infer: true });

    if (!email || !password) {
      return;
    }

    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      if (existing.role !== Role.Admin) {
        this.logger.warn(
          `ADMIN_EMAIL ${email} exists with role "${existing.role}" – not changed.`,
        );
      }
      return;
    }

    await this.usersService.create({
      email,
      passwordHash: await bcrypt.hash(password, PASSWORD_SALT_ROUNDS),
      fullName:
        this.config.get('ADMIN_NAME', { infer: true }) ?? 'Administrator',
      role: Role.Admin,
    });
    this.logger.log(`Seeded admin account ${email}`);
  }
}
