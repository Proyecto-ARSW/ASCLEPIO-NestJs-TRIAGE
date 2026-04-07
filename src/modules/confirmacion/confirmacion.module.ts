// src/modules/confirmacion/confirmacion.module.ts

import { Module } from '@nestjs/common';
import { ConfirmacionController } from './confirmacion.controller';
import { ConfirmacionService } from './confirmacion.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ColaModule } from '../cola/cola.module';
import { AlertasModule } from '../alertas/alertas.module';

@Module({
  imports: [
    PrismaModule,
    ColaModule,
    AlertasModule,
  ],
  controllers: [ConfirmacionController],
  providers: [ConfirmacionService],
  exports: [ConfirmacionService],
})
export class ConfirmacionModule {}