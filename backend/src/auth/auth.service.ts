import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { EnvironmentVariables } from '../config/env.validation.js';
import { PASSWORD_SALT_ROUNDS } from '../users/admin-seed.service.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type {
  AuthTokens,
  JwtPayload,
} from './interfaces/jwt-payload.interface.js';

export type AuthResult = { user: User; tokens: AuthTokens };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    if (await this.usersService.existsByEmail(dto.email)) {
      throw new ConflictException('Email này đã được đăng ký');
    }

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash: await this.hashPassword(dto.password),
      fullName: dto.fullName,
      phone: dto.phone ?? null,
    });

    const tokens = await this.issueTokens(user);
    await this.usersService.markLogin(user.id);
    return { user, tokens };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmailWithSecrets(dto.email);

    // Same error for unknown email / wrong password so accounts cannot be enumerated.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    const tokens = await this.issueTokens(user);
    await this.usersService.markLogin(user.id);
    return { user: await this.usersService.findById(user.id), tokens };
  }

  /** Rotates the refresh token: the presented token must match the stored hash and is replaced. */
  async refresh(userId: number, refreshToken: string): Promise<AuthTokens> {
    const user = await this.usersService.findByIdWithSecrets(userId);

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    }

    if (!this.refreshTokenMatches(refreshToken, user.refreshTokenHash)) {
      // Token reuse (e.g. stolen + already rotated): revoke the whole session.
      await this.usersService.updateRefreshTokenHash(user.id, null);
      throw new UnauthorizedException('Phiên đăng nhập không còn hợp lệ, vui lòng đăng nhập lại');
    }

    return this.issueTokens(user);
  }

  async logout(userId: number) {
    await this.usersService.updateRefreshTokenHash(userId, null);
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdWithSecrets(userId);

    if (
      !user ||
      !(await bcrypt.compare(dto.currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    await this.usersService.updatePassword(
      user.id,
      await this.hashPassword(dto.newPassword),
    );
  }

  hashPassword(password: string) {
    return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  }

  /**
   * Refresh tokens are stored as SHA-256 digests, not bcrypt: bcrypt only hashes the
   * first 72 bytes and two JWTs share their header/payload prefix, so bcrypt would treat
   * a rotated-out token as still valid. JWTs are high-entropy, so a plain digest is safe.
   */
  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshTokenMatches(token: string, storedHash: string) {
    const actual = Buffer.from(this.hashRefreshToken(token));
    const expected = Buffer.from(storedHash);
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private async issueTokens(
    user: Pick<User, 'id' | 'email' | 'role'>,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessExpiresIn = this.config.get('JWT_ACCESS_EXPIRES_IN', {
      infer: true,
    });
    const refreshExpiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', {
      infer: true,
    });

    // `jwtid` makes every token unique even when issued within the same second
    // (otherwise two refreshes in a row could produce identical tokens and break rotation).
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        // Env values are validated as strings; `ms` expects its own template type.
        expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
        jwtid: randomUUID(),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
        jwtid: randomUUID(),
      }),
    ]);

    await this.usersService.updateRefreshTokenHash(
      user.id,
      this.hashRefreshToken(refreshToken),
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresIn,
    };
  }
}
