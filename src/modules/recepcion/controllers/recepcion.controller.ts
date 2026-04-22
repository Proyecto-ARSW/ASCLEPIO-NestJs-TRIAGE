import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { RecepcionService } from '../services/recepcion.service';
import { IngresoTriageDto } from '../dto/ingreso-triage.dto';

@Controller('recepcion')
export class RecepcionController {
  constructor(private readonly recepcionService: RecepcionService) {}

  @Post('ingreso')
  @HttpCode(200)
  async recibirIngreso(@Body() dto: IngresoTriageDto) {
    return this.recepcionService.procesarIngreso(dto);
  }
}
