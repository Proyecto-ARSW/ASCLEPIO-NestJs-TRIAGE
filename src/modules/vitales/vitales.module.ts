// src/modules/vitales/vitales.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VitalesController } from './vitales.controller';
import { VitalesService } from './vitales.service';
import { ClassifierGatewayService } from './services/classifier-gateway.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
  ],
  controllers: [VitalesController],
  providers: [VitalesService, ClassifierGatewayService],
  exports: [VitalesService],
})
export class VitalesModule {}