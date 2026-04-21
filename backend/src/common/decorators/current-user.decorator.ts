import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../../users/user.types';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
