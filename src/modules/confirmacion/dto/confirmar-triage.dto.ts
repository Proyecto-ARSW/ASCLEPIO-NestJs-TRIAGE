// src/modules/confirmacion/dto/confirmar-triage.dto.ts

import { IsUUID, IsInt, Min, Max, IsBoolean, IsString, IsOptional, ValidateIf } from 'class-validator';

export class ConfirmarTriageDto {
  @IsUUID()
  registro_triage_id: string;

  @IsUUID()
  enfermero_id: string;

  @IsInt()
  @Min(1)
  @Max(5)
  nivel_final: number;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.acepto_sugerencia)
  razon_modificacion?: string;
}