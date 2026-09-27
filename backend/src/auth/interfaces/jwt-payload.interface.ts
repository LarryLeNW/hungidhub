import type { Role } from '../../common/enums/role.enum.js';

export interface JwtPayload {
  /** User id */
  sub: number;
  email: string;
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access token lifetime as configured (e.g. "15m") */
  expiresIn: string;
}
