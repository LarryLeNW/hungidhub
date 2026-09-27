import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { EnvironmentVariables } from '../../config/env.validation.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

export type RefreshRequestUser = JwtPayload & { refreshToken: string };

/** Refresh-token strategy: reads `refreshToken` from the JSON body and verifies it with the refresh secret. */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_REFRESH_SECRET', { infer: true }),
      passReqToCallback: true,
    });
  }

  validate(request: Request, payload: JwtPayload): RefreshRequestUser {
    const refreshToken = (request.body as { refreshToken?: unknown })
      ?.refreshToken;

    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new UnauthorizedException('Thiếu refresh token');
    }

    return { ...payload, refreshToken };
  }
}
