import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../users/entities/user.entity.js';

/** Injects the authenticated user (set by JwtStrategy) into a handler parameter. */
export const CurrentUser = createParamDecorator(
  (field: keyof User | undefined, context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
