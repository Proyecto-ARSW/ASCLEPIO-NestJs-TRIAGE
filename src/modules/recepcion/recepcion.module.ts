import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RecepcionController } from './controllers/recepcion.controller';
import { RecepcionService } from './services/recepcion.service';
import { ClassifierGatewayService } from './services/classifier-gateway.service';
import { IsisVoiceApiKeyGuard } from '@/common/guards/isisvoice-api-key.guard';
import { CoreClientModule } from '@/modules/core-client/core-client.module';
import { WebsocketsModule } from '@/modules/websockets/websockets.module';
import { EventosModule } from '@/modules/eventos/eventos.module';
import { PrismaModule } from '@/modules/prisma/prisma.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    CoreClientModule,
    WebsocketsModule,
    EventosModule,
    PrismaModule,
  ],
  controllers: [RecepcionController],
  providers: [RecepcionService, ClassifierGatewayService, IsisVoiceApiKeyGuard],
})
export class RecepcionModule {}