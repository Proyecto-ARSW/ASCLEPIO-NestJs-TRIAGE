// src/modules/confirmacion/dto/confirmar-triage.dto.ts

import { IsUUID, IsInt, Min, Max, IsString, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmarTriageDto {
  @ApiProperty({ description: 'ID UUID del registro de triage a confirmar', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  registro_triage_id: string;

  @ApiProperty({ description: 'ID UUID del enfermero que confirma', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  @IsUUID()
  enfermero_id: string;

  @ApiProperty({ description: 'Nivel de triage final asignado (1=rojo crítico, 5=verde)', minimum: 1, maximum: 5, example: 3 })
  @IsInt()
  @Min(1)
  @Max(5)
  nivel_final: number;

  @ApiPropertyOptional({ description: 'Razón de modificación del nivel sugerido por la IA (requerido si se modifica)', example: 'El paciente presenta signos adicionales no capturados por el sistema' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.acepto_sugerencia)
  razon_modificacion?: string;
}
