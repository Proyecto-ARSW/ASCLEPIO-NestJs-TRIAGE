// src/modules/turnos/services/generador-numero.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { TipoTurno } from '../entities/turno.entity';

@Injectable()
export class GeneradorNumeroService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera el siguiente número de turno disponible para un hospital y fecha
   */
  async generarNumeroTurno(
    hospitalId: number,
    tipoTurno: TipoTurno,
    fecha: Date = new Date(),
  ): Promise<number> {
    const fechaNormalizada = new Date(fecha);
    fechaNormalizada.setHours(0, 0, 0, 0);

    const ultimoTurno = await this.prisma.turnos.findFirst({
      where: {
        hospital_id: hospitalId,
        tipo_turno: tipoTurno,
        fecha: fechaNormalizada,
      },
      orderBy: {
        numero_turno: 'desc',
      },
    });

    return ultimoTurno ? ultimoTurno.numero_turno + 1 : 1;
  }

  /**
   * Reinicia la numeración de turnos (se ejecuta automáticamente cada día)
   */
  async reiniciarNumeracion(hospitalId: number): Promise<void> {
  }
}
