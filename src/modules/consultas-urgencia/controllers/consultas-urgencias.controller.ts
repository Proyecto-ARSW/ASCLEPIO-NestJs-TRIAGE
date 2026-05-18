import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ConsultasUrgenciaService } from '../services/consultas-urgencia.service';

@ApiTags('ConsultasUrgencia')
@Controller('consultas-urgencia')
export class ConsultasUrgenciaController {
  constructor(
    private readonly consultasUrgenciaService: ConsultasUrgenciaService,
  ) {}

  @Get('paciente/:id')
  @ApiOperation({
    summary: 'Obtener consultas de urgencia de un paciente',
    description:
      'Retorna las consultas de urgencia atendidas de un paciente con el nombre del médico, paginadas.',
  })
  @ApiParam({ name: 'id', description: 'UUID del paciente' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Registros por página (default: 5)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de consultas de urgencia.' })
  async findByPaciente(
    @Param('id') pacienteId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 5,
  ) {
    return this.consultasUrgenciaService.findByPaciente(
      pacienteId,
      Number(page),
      Number(limit),
    );
  }
}