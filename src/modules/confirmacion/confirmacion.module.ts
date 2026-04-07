// src/modules/confirmacion/confirmacion.module.ts

import { Module } from '@nestjs/common';
import { ConfirmacionController } from './controllers/confirmacion.controller';
import { ConfirmacionService } from './services/confirmacion.service';
import { PrismaModule } from 'src/modules/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConfirmacionController],
  providers: [ConfirmacionService],
  exports: [ConfirmacionService],
})
export class ConfirmacionModule {}