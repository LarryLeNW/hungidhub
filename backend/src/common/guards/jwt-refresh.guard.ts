import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Validates the refresh token sent in the request body (see JwtRefreshStrategy). */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
