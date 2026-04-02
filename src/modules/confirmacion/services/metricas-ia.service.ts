// src/modules/confirmacion/services/metricas-ia.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MetricasIA, MetricasEnfermero } from '../dto/metricas-ia.dto';

@Injectable()
export class MetricasIAService {
  private readonly logger = new Logger(MetricasIAService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula métricas de precisión del sistema de IA
   */
  async calcularMetricasIA(
    hospitalId?: number,
    fechaInicio?: Date,
    fechaFin?: Date,
  ): Promise<MetricasIA> {
    const inicio = fechaInicio || this.obtenerInicioMes();
    const fin = fechaFin || new Date();

    this.logger.debug(
      `Calculando métricas IA - Hospital: ${hospitalId || 'TODOS'} - Período: ${inicio.toISOString()} a ${fin.toISOString()}`,
    );

    const confirmaciones = await this.prisma.confirmaciones_enfermero.findMany({
      where: {
        creado_en: {
          gte: inicio,
          lte: fin,
        },
        ...(hospitalId && {
          registro_triage: {
            hospital_id: hospitalId,
          },
        }),
      },
      include: {
        registro_triage: true,
      },
    });

    const total = confirmaciones.length;

    if (total === 0) {
      return this.metricsVacias(inicio, fin);
    }

    const aceptadas = confirmaciones.filter(c => c.acepto_sugerencia).length;
    const modificadas = total - aceptadas;

    const precisionPorNivel = this.calcularPrecisionPorNivel(confirmaciones);

    const escalamientos = confirmaciones.filter(
      c => c.nivel_final_enfermero < c.nivel_sugerido_ollama,
    ).length;

    const degradaciones = confirmaciones.filter(
      c => c.nivel_final_enfermero > c.nivel_sugerido_ollama,
    ).length;

    return {
      total_evaluaciones: total,
      total_aceptadas: aceptadas,
      total_modificadas: modificadas,
      tasa_aceptacion: (aceptadas / total) * 100,
      precision_nivel_1: precisionPorNivel[1],
      precision_nivel_2: precisionPorNivel[2],
      precision_nivel_3: precisionPorNivel[3],
      precision_nivel_4: precisionPorNivel[4],
      precision_nivel_5: precisionPorNivel[5],
      precision_general: (aceptadas / total) * 100,
      escalamientos,
      degradaciones,
      periodo_inicio: inicio,
      periodo_fin: fin,
    };
  }

  /**
   * Calcula métricas de un enfermero específico
   */
  async calcularMetricasEnfermero(
    enfermeroId: string,
    fechaInicio?: Date,
    fechaFin?: Date,
  ): Promise<MetricasEnfermero> {
    const inicio = fechaInicio || this.obtenerInicioMes();
    const fin = fechaFin || new Date();

    const enfermero = await this.prisma.enfermeros.findUnique({
      where: { id: enfermeroId },
      include: {
        usuarios: true,
      },
    });

    if (!enfermero) {
      throw new NotFoundException('Enfermero no encontrado');
    }

    const confirmaciones = await this.prisma.confirmaciones_enfermero.findMany({
      where: {
        enfermero_id: enfermeroId,
        creado_en: {
          gte: inicio,
          lte: fin,
        },
      },
    });

    const total = confirmaciones.length;

    if (total === 0) {
      return {
        enfermero_id: enfermeroId,
        nombre_completo: `${enfermero.usuarios.nombre} ${enfermero.usuarios.apellido}`,
        evaluaciones_realizadas: 0,
        tasa_aceptacion_ia: 0,
        tiempo_promedio_evaluacion_seg: 0,
        escalamientos_realizados: 0,
        periodo: `${inicio.toLocaleDateString()} - ${fin.toLocaleDateString()}`,
      };
    }

    const aceptadas = confirmaciones.filter(c => c.acepto_sugerencia).length;
    const escalamientos = confirmaciones.filter(
      c => c.nivel_final_enfermero < c.nivel_sugerido_ollama,
    ).length;

    const tiempoPromedio =
      confirmaciones.reduce((sum, c) => sum + (c.tiempo_evaluacion_ms || 0), 0) /
      total /
      1000;

    return {
      enfermero_id: enfermeroId,
      nombre_completo: `${enfermero.usuarios.nombre} ${enfermero.usuarios.apellido}`,
      evaluaciones_realizadas: total,
      tasa_aceptacion_ia: (aceptadas / total) * 100,
      tiempo_promedio_evaluacion_seg: tiempoPromedio,
      escalamientos_realizados: escalamientos,
      periodo: `${inicio.toLocaleDateString()} - ${fin.toLocaleDateString()}`,
    };
  }

  /**
   * Calcula precisión por nivel de triage
   */
  private calcularPrecisionPorNivel(confirmaciones: any[]): {
    [key: number]: number;
  } {
    const precision: { [key: number]: number } = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    for (let nivel = 1; nivel <= 5; nivel++) {
      const confirmacionesNivel = confirmaciones.filter(
        c => c.nivel_sugerido_ollama === nivel,
      );

      if (confirmacionesNivel.length > 0) {
        const aceptadas = confirmacionesNivel.filter(c => c.acepto_sugerencia).length;
        precision[nivel] = (aceptadas / confirmacionesNivel.length) * 100;
      }
    }

    return precision;
  }

  /**
   * Métricas vacías cuando no hay datos
   */
  private metricsVacias(inicio: Date, fin: Date): MetricasIA {
    return {
      total_evaluaciones: 0,
      total_aceptadas: 0,
      total_modificadas: 0,
      tasa_aceptacion: 0,
      precision_nivel_1: 0,
      precision_nivel_2: 0,
      precision_nivel_3: 0,
      precision_nivel_4: 0,
      precision_nivel_5: 0,
      precision_general: 0,
      escalamientos: 0,
      degradaciones: 0,
      periodo_inicio: inicio,
      periodo_fin: fin,
    };
  }

  /**
   * Obtiene el inicio del mes actual
   */
  private obtenerInicioMes(): Date {
    const ahora = new Date();
    return new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  }
}