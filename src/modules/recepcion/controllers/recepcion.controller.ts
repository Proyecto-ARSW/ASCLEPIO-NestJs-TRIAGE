import {
  Controller,
  Post,
  Body,
  HttpCode,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiHeader,
} from '@nestjs/swagger';
import { RecepcionService } from '../services/recepcion.service';
import { IngresoTriageDto } from '../dto/ingreso-triage.dto';
import { IngresoISISvoiceDto } from '../dto/ingreso-isisvoice.dto';
import { IsisVoiceApiKeyGuard } from '@/common/guards/isisvoice-api-key.guard';

@ApiTags('Recepcion')
@Controller('recepcion')
export class RecepcionController {
  constructor(private readonly recepcionService: RecepcionService) {}

  @Post('ingreso')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Registrar ingreso a triage (uso interno)',
    description: 'Endpoint interno para registrar ingreso con datos ya normalizados.',
  })
  @ApiConsumes('application/json')
  @ApiBody({ type: IngresoTriageDto })
  @ApiResponse({ status: 200, description: 'Ingreso procesado correctamente.' })
  @ApiResponse({ status: 400, description: 'Solicitud inválida o datos incompletos.' })
  @ApiResponse({ status: 500, description: 'Error interno al procesar el ingreso.' })
  async recibirIngreso(@Body() dto: IngresoTriageDto) {
    return this.recepcionService.procesarIngreso(dto);
  }

  @Post('ingreso-isisvoice')
  @HttpCode(200)
  @UseGuards(IsisVoiceApiKeyGuard)
  @ApiOperation({
    summary: 'Registrar ingreso desde ISISvoice',
    description:
      'Recibe el payload completo generado por ISISvoice (síntomas + signos vitales) y lo procesa en el flujo de triage.',
  })
  @ApiHeader({
    name: 'x-api-key',
    description: 'Clave compartida con ISISvoice',
    required: true,
  })
  @ApiQuery({ name: 'hospital_id', type: Number, description: 'ID del hospital' })
  @ApiQuery({ name: 'enfermero_id', type: String, description: 'UUID del enfermero' })
  @ApiConsumes('application/json')
  @ApiBody({ type: IngresoISISvoiceDto })
  @ApiResponse({ status: 200, description: 'Ingreso desde ISISvoice procesado correctamente.' })
  @ApiResponse({ status: 400, description: 'Payload de ISISvoice inválido.' })
  @ApiResponse({ status: 401, description: 'API key inválida.' })
  @ApiResponse({ status: 502, description: 'Error comunicándose con el Core para resolver el paciente.' })
  async recibirIngresoISISvoice(
    @Body() dto: IngresoISISvoiceDto,
    @Query('hospital_id', ParseIntPipe) hospitalId: number,
    @Query('enfermero_id') enfermeroId: string,
  ) {
    return this.recepcionService.procesarIngresoISISvoice(dto, hospitalId, enfermeroId);
  }
}