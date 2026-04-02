// src/modules/websockets/guards/ws-auth.guard.ts

import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedSocket } from '../interfaces/socket-client.interface';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client = context.switchToWs().getClient<AuthenticatedSocket>();
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        throw new WsException('No se proporcionó token de autenticación');
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = jwt.verify(token, secret) as any;
      client.user = {
        id: payload.id || payload.sub,
        email: payload.email,
        rol: payload.rol,
        nombre: payload.nombre,
        apellido: payload.apellido,
      };

      this.logger.debug(
        `WebSocket autenticado - Usuario: ${client.user.email} (${client.user.rol})`,
      );

      return true;
    } catch (error) {
      this.logger.error(`WebSocket auth error: ${error.message}`);
      throw new WsException('Token inválido o expirado');
    }
  }

  private extractTokenFromHandshake(client: AuthenticatedSocket): string | undefined {

    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer') {
        return token;
      }
    }

    const queryToken = client.handshake?.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    const authToken = client.handshake?.auth?.token;
    if (authToken) {
      return authToken;
    }

    return undefined;
  }
}