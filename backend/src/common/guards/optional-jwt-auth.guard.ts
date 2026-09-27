import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Populates `req.user` when a valid bearer token is present but never rejects the request.
 * Use together with `@Public()` on routes that work for guests and signed-in users alike.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Explicit constructor so Nest does not try to inject Passport's AuthModuleOptions here.
  constructor() {
    super();
  }

  override async canActivate(context: ExecutionContext) {
    try {
      await super.canActivate(context);
    } catch {
      // missing / expired token -> anonymous
    }
    return true;
  }

  override handleRequest<TUser = unknown>(
    _err: unknown,
    user: TUser | false,
  ): TUser | null {
    return user || null;
  }
}
