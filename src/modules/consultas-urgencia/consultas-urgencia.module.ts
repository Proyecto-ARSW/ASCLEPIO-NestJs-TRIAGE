import { Module } from '@nestjs/common';
import { ConsultasUrgenciaController } from './controllers/consultas-urgencias.controller';
import { ConsultasUrgenciaService } from './services/consultas-urgencia.service';
import { PrismaModule } from '@/modules/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConsultasUrgenciaController],
  providers: [ConsultasUrgenciaService],
})
export class ConsultasUrgenciaModule {}