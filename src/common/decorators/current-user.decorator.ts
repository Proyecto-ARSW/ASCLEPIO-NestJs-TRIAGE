import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface UserPayload {
  id: string;
  email: string;
  rol: string;
  nombre: string;
  apellido: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof UserPayload | undefined, context: ExecutionContext): UserPayload | any => {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest();
      const user = request.user;

      return data ? user?.[data] : user;
    }

    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const user = request?.user;

    return data ? user?.[data] : user;
  },
);