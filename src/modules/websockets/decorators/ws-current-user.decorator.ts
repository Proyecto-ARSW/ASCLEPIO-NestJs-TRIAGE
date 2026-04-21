// src/modules/websockets/decorators/ws-current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedSocket } from '../interfaces/socket-client.interface';

export const WsCurrentUser = createParamDecorator(
  (data: string | undefined, context: ExecutionContext) => {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const user = client.user;

    return data ? user?.[data] : user;
  },
);