import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IsisVoiceApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(IsisVoiceApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const validKey = this.configService.get<string>('ISISVOICE_WEBHOOK_SECRET');

    if (!validKey) {
      const env = this.configService.get<string>('NODE_ENV', 'development');
      if (env !== 'production') {
        this.logger.warn(
          'ISISVOICE_WEBHOOK_SECRET no configurado — permitiendo en desarrollo',
        );
        return true;
      }
      throw new UnauthorizedException('Servicio no configurado correctamente');
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || apiKey !== validKey) {
      throw new UnauthorizedException('API key inválida');
    }

    return true;
  }
}