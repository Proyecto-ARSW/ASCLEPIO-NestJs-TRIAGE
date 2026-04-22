import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RecepcionController } from './controllers/recepcion.controller';
import { RecepcionService } from './services/recepcion.service';
import { ClassifierGatewayService } from './services/classifier-gateway.service';

@Module({
  imports: [HttpModule],
  controllers: [RecepcionController],
  providers: [RecepcionService, ClassifierGatewayService],
  exports: [RecepcionService],
})
export class RecepcionModule {}
