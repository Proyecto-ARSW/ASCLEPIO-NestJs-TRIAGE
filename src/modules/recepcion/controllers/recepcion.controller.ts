import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { RecepcionService } from '../services/recepcion.service';
import { IngresoTriageDto } from '../dto/ingreso-triage.dto';

@ApiTags('Recepcion')
@Controller('recepcion')
export class RecepcionController {
  constructor(private readonly recepcionService: RecepcionService) {}

  @Post('ingreso')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Registrar ingreso a triage',
    description:
      'Recibe el payload de ingreso desde recepcion y procesa la clasificacion preliminar para generar/actualizar el flujo de triage.',
  })
  @ApiConsumes('application/json')
  @ApiBody({ type: IngresoTriageDto })
  @ApiResponse({
    status: 200,
    description: 'Ingreso procesado correctamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'Solicitud invalida o datos incompletos.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno al procesar el ingreso.',
  })
  async recibirIngreso(@Body() dto: IngresoTriageDto) {
    return this.recepcionService.procesarIngreso(dto);
  }
}
