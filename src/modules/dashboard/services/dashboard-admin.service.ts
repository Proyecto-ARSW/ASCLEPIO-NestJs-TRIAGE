// src/modules/dashboard/services/dashboard-admin.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { DashboardAdmin } from '../dto/dashboard-admin.dto';
import { EstadoTurno } from 'src/modules/turnos/entities/turno.entity';

@Injectable()
export class DashboardAdminService {
  private readonly logger = new Logger(DashboardAdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el dashboard administrativo completo
   */
  async obtenerDashboard(hospitalId: number): Promise<DashboardAdmin> {
    this.logger.debug(`Dashboard admin - Hospital: ${hospitalId}`);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(inicioSemana.getDate() - 7);

    const kpis = await this.calcularKPIs(hospitalId, hoy, ayer);

    const tendenciaAtendidos = await this.calcularTendenciaAtendidos(
      hospitalId,
      inicioSemana,
    );

    const distribucionSemanal = await this.calcularDistribucionSemanal(
      hospitalId,
      inicioSemana,
    );

    const rendimientoIA = await this.calcularRendimientoIA(hospitalId, inicioSemana);

    const analisisTiempos = await this.calcularAnalisisTiempos(hospitalId, inicioSemana);

    const analisisPersonal = await this.calcularAnalisisPersonal(
      hospitalId,
      inicioSemana,
    );

    return {
      kpis,
      tendencia_atendidos: tendenciaAtendidos,
      distribucion_semanal: distribucionSemanal,
      rendimiento_ia: rendimientoIA,
      analisis_tiempos: analisisTiempos,
      analisis_personal: analisisPersonal,
    };
  }

  /**
   * Calcula KPIs principales
   */
  private async calcularKPIs(hospitalId: number, hoy: Date, ayer: Date) {
    const turnosHoy = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        fecha: { gte: hoy },
      },
    });

    const turnosAyer = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        fecha: {
          gte: ayer,
          lt: hoy,
        },
      },
    });

    const atendidosHoy = turnosHoy.filter((t) => t.estado === EstadoTurno.ATENDIDO).length;
    const atendidosAyer = turnosAyer.filter((t) => t.estado === EstadoTurno.ATENDIDO).length;

    const enSistemaHoy = turnosHoy.filter(
      (t) => t.estado !== EstadoTurno.ATENDIDO && t.estado !== EstadoTurno.CANCELADO,
    ).length;
    const enSistemaAyer = turnosAyer.filter(
      (t) => t.estado !== EstadoTurno.ATENDIDO && t.estado !== EstadoTurno.CANCELADO,
    ).length;

    const turnosConTiempoHoy = turnosHoy.filter(
      (t) => t.estado === EstadoTurno.ATENDIDO && t.llamado_en,
    );
    let tiempoPromedioHoy = 0;

    if (turnosConTiempoHoy.length > 0) {
      const suma = turnosConTiempoHoy.reduce((acc, t) => {
        return acc + (t.llamado_en.getTime() - t.creado_en.getTime());
      }, 0);
      tiempoPromedioHoy = Math.floor(suma / turnosConTiempoHoy.length / 60000);
    }

    const turnosConTiempoAyer = turnosAyer.filter(
      (t) => t.estado === EstadoTurno.ATENDIDO && t.llamado_en,
    );
    let tiempoPromedioAyer = 0;

    if (turnosConTiempoAyer.length > 0) {
      const suma = turnosConTiempoAyer.reduce((acc, t) => {
        return acc + (t.llamado_en.getTime() - t.creado_en.getTime());
      }, 0);
      tiempoPromedioAyer = Math.floor(suma / turnosConTiempoAyer.length / 60000);
    }

    const satisfaccion = 4.2;
    const satisfaccionAyer = 3.9;

    return {
      atendidos: atendidosHoy,
      cambio_porcentaje:
        atendidosAyer > 0 ? ((atendidosHoy - atendidosAyer) / atendidosAyer) * 100 : 0,
      en_sistema: enSistemaHoy,
      cambio_sistema_porcentaje:
        enSistemaAyer > 0 ? ((enSistemaHoy - enSistemaAyer) / enSistemaAyer) * 100 : 0,
      tiempo_promedio: tiempoPromedioHoy,
      cambio_tiempo_minutos: tiempoPromedioHoy - tiempoPromedioAyer,
      satisfaccion,
      cambio_satisfaccion: satisfaccion - satisfaccionAyer,
    };
  }

  /**
   * Calcula tendencia de atendidos por día
   */
  private async calcularTendenciaAtendidos(hospitalId: number, inicioSemana: Date) {
    const puntos: Array<{ fecha: string; valor: number }> = [];

    for (let i = 0; i < 7; i++) {
      const fecha = new Date(inicioSemana);
      fecha.setDate(fecha.getDate() + i);

      const siguienteDia = new Date(fecha);
      siguienteDia.setDate(siguienteDia.getDate() + 1);

      const atendidos = await this.prisma.turnos.count({
        where: {
          hospital_id: hospitalId,
          estado: EstadoTurno.ATENDIDO,
          fecha: {
            gte: fecha,
            lt: siguienteDia,
          },
        },
      });

      puntos.push({
        fecha: fecha.toISOString().split('T')[0],
        valor: atendidos,
      });
    }

    return puntos;
  }

  /**
   * Calcula distribución semanal por nivel
   */
  private async calcularDistribucionSemanal(hospitalId: number, inicioSemana: Date) {
    const turnos = await this.prisma.turnos.findMany({
      where: {
        hospital_id: hospitalId,
        fecha: { gte: inicioSemana },
        nivel_triage_id: { not: null },
      },
    });

    const total = turnos.length || 1;

    const counts = {
      nivel_1: turnos.filter((t) => t.nivel_triage_id === 1).length,
      nivel_2: turnos.filter((t) => t.nivel_triage_id === 2).length,
      nivel_3: turnos.filter((t) => t.nivel_triage_id === 3).length,
      nivel_4: turnos.filter((t) => t.nivel_triage_id === 4).length,
      nivel_5: turnos.filter((t) => t.nivel_triage_id === 5).length,
    };

    return {
      nivel_1: counts.nivel_1,
      nivel_1_porcentaje: (counts.nivel_1 / total) * 100,
      nivel_2: counts.nivel_2,
      nivel_2_porcentaje: (counts.nivel_2 / total) * 100,
      nivel_3: counts.nivel_3,
      nivel_3_porcentaje: (counts.nivel_3 / total) * 100,
      nivel_4: counts.nivel_4,
      nivel_4_porcentaje: (counts.nivel_4 / total) * 100,
      nivel_5: counts.nivel_5,
      nivel_5_porcentaje: (counts.nivel_5 / total) * 100,
    };
  }

  /**
   * Calcula rendimiento del sistema de IA
   */
  private async calcularRendimientoIA(hospitalId: number, inicioSemana: Date) {
    const confirmaciones = await this.prisma.confirmaciones_enfermero.findMany({
      where: {
        creado_en: { gte: inicioSemana },
        registro_triage: {
          hospital_id: hospitalId,
        },
      },
      include: {
        registro_triage: true
      },
    });

    const total = confirmaciones.length || 1;
    const aceptadas = confirmaciones.filter((c) => c.acepto_sugerencia).length;


    const conPreclasificacion = confirmaciones.filter(
      (c) => c.registro_triage.nivel_preliminar_isisvoice != null,
    );
    const ollamaCorrectos = conPreclasificacion.filter((c) => c.acepto_sugerencia).length;
    const precisionOllama =
      conPreclasificacion.length > 0 ? (ollamaCorrectos / conPreclasificacion.length) * 100 : 0;

    const precisionRF = (aceptadas / total) * 100;

    const matriz = this.construirMatrizConfusion(confirmaciones);

    const factores = await this.calcularFactoresAjuste(confirmaciones);

    return {
      precision_ollama: precisionOllama,
      precision_random_forest: precisionRF,
      matriz_confusion: matriz,
      factores_ajuste: factores,
    };
  }

  /**
   * Construye matriz de confusión
   */
  private construirMatrizConfusion(confirmaciones: any[]) {
    const matriz = Array(5)
      .fill(0)
      .map(() => Array(5).fill(0));

    for (const conf of confirmaciones) {
      const predicho = conf.nivel_sugerido_ia - 1; 
      const real = conf.nivel_final_enfermero - 1;

      if (predicho >= 0 && predicho < 5 && real >= 0 && real < 5) {
        matriz[predicho][real]++;
      }
    }

    return {
      matriz,
      etiquetas: ['Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4', 'Nivel 5'],
    };
  }

  /**
   * Calcula factores de ajuste más frecuentes
   */
  private async calcularFactoresAjuste(confirmaciones: any[]) {
    const factoresMap = new Map<string, { count: number; tipo: string }>();

    for (const conf of confirmaciones) {
      if (!conf.acepto_sugerencia && conf.razon_modificacion) {
        const razon = conf.razon_modificacion;
        const tipo =
          conf.nivel_final_enfermero < conf.nivel_sugerido_ia 
            ? 'ESCALAMIENTO'
            : 'DEGRADACIÓN';

        if (factoresMap.has(razon)) {
          factoresMap.get(razon)!.count++;  
        } else {
          factoresMap.set(razon, { count: 1, tipo });
        }
      }
    }

    const factores = Array.from(factoresMap.entries())
      .map(([factor, data]) => ({
        factor,
        frecuencia: data.count,
        tipo: data.tipo,
      }))
      .sort((a, b) => b.frecuencia - a.frecuencia)
      .slice(0, 10);

    return factores;
  }

  /**
   * Calcula análisis de tiempos
   */
  private async calcularAnalisisTiempos(hospitalId: number, inicioSemana: Date) {
    const tiemposPorNivel: Array<{
      nivel: number;
      espera: number;
      atencion: number;
      total: number;
      objetivo: number;
      cumple_objetivo: boolean;
    }> = [];

    const objetivos: Record<number, number> = {
      1: 30,
      2: 40,
      3: 60,
      4: 90,
      5: 180,
    };

    for (let nivel = 1; nivel <= 5; nivel++) {
      const turnos = await this.prisma.turnos.findMany({
        where: {
          hospital_id: hospitalId,
          nivel_triage_id: nivel,
          estado: EstadoTurno.ATENDIDO,
          fecha: { gte: inicioSemana },
          llamado_en: { not: null },
          finalizado_en: { not: null },
        },
      });

      if (turnos.length === 0) {
        tiemposPorNivel.push({
          nivel,
          espera: 0,
          atencion: 0,
          total: 0,
          objetivo: objetivos[nivel],
          cumple_objetivo: true,
        });
        continue;
      }

      let sumaEspera = 0;
      let sumaAtencion = 0;

      for (const turno of turnos) {
        const espera = turno.llamado_en.getTime() - turno.creado_en.getTime();
        const atencion = turno.finalizado_en.getTime() - turno.llamado_en.getTime();

        sumaEspera += espera;
        sumaAtencion += atencion;
      }

      const esperaPromedio = Math.floor(sumaEspera / turnos.length / 60000);
      const atencionPromedio = Math.floor(sumaAtencion / turnos.length / 60000);
      const totalPromedio = esperaPromedio + atencionPromedio;

      tiemposPorNivel.push({
        nivel,
        espera: esperaPromedio,
        atencion: atencionPromedio,
        total: totalPromedio,
        objetivo: objetivos[nivel],
        cumple_objetivo: totalPromedio <= objetivos[nivel],
      });
    }

    const cuellos = await this.detectarCuellosDeBottella(hospitalId, inicioSemana);

    return {
      tiempos_por_nivel: tiemposPorNivel,
      cuellos_botella: cuellos,
    };
  }

  /**
   * Detecta cuellos de botella en el proceso
   */
  private async detectarCuellosDeBottella(hospitalId: number, inicioSemana: Date) {
    // TODO: Implementar detección de cuellos de botella con evaluaciones_preliminares
    // Por ahora retornamos array vacío ya que requiere joins complejos
    
    const cuellos: Array<{
      etapa: string;
      tiempo_actual: number;
      tiempo_objetivo: number;
      recomendacion: string;
    }> = [];

    this.logger.debug('Detección de cuellos de botella pendiente de implementar');

    return cuellos;
  }

  /**
   * Calcula análisis de personal
   */
  private async calcularAnalisisPersonal(hospitalId: number, inicioSemana: Date) {
    const productividadMedicos = await this.calcularProductividadMedicos(
      hospitalId,
      inicioSemana,
    );

    const precisionEnfermeros = await this.calcularPrecisionEnfermeros(
      hospitalId,
      inicioSemana,
    );

    return {
      productividad_medicos: productividadMedicos,
      precision_enfermeros: precisionEnfermeros,
    };
  }

  /**
   * Calcula productividad de médicos (pacientes/hora)
   */
  private async calcularProductividadMedicos(hospitalId: number, inicioSemana: Date) {
    const medicos = await this.prisma.medicos.findMany({
      where: {
        activo: true,
      },
    });

    const productividad: Array<{
      medico_id: string;  
      nombre: string;
      pacientes_por_hora: number;
      total_atendidos: number;
    }> = [];

    for (const medico of medicos) {
      const usuario = await this.prisma.usuarios.findUnique({
        where: { id: medico.usuario_id },
      });

      const turnos = await this.prisma.turnos.findMany({
        where: {
          hospital_id: hospitalId, 
          medico_id: medico.id,
          estado: EstadoTurno.ATENDIDO,
          fecha: { gte: inicioSemana },
          llamado_en: { not: null },
          finalizado_en: { not: null },
        },
      });

      if (turnos.length === 0) continue;

      let tiempoTotalMs = 0;
      for (const turno of turnos) {
        tiempoTotalMs += turno.finalizado_en.getTime() - turno.llamado_en.getTime();
      }

      const horasTrabajadas = tiempoTotalMs / 3600000;
      const pacientesPorHora =
        horasTrabajadas > 0 ? turnos.length / horasTrabajadas : 0;

      productividad.push({
        medico_id: medico.id,
        nombre: usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Desconocido',
        pacientes_por_hora: parseFloat(pacientesPorHora.toFixed(1)),
        total_atendidos: turnos.length,
      });
    }

    productividad.sort((a, b) => b.pacientes_por_hora - a.pacientes_por_hora);

    return productividad;
  }

  /**
   * Calcula precisión de enfermeros
   */
  private async calcularPrecisionEnfermeros(hospitalId: number, inicioSemana: Date) {
    const enfermeros = await this.prisma.enfermeros.findMany({
      where: {
        activo: true,
      },
    });

    const precisiones: Array<{
      enfermero_id: string; 
      nombre: string;
      precision: number;
      evaluaciones_realizadas: number;
    }> = [];

    for (const enfermero of enfermeros) {
      // Obtener usuario del enfermero
      const usuario = await this.prisma.usuarios.findUnique({
        where: { id: enfermero.usuario_id },
      });

      const confirmaciones = await this.prisma.confirmaciones_enfermero.findMany({
        where: {
          enfermero_id: enfermero.id,
          creado_en: { gte: inicioSemana },
          registro_triage: {
            hospital_id: hospitalId,
          },
        },
      });

      if (confirmaciones.length === 0) continue;

      const aceptadas = confirmaciones.filter((c) => c.acepto_sugerencia).length;
      const precision = (aceptadas / confirmaciones.length) * 100;

      precisiones.push({
        enfermero_id: enfermero.id,
        nombre: usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Desconocido',
        precision: parseFloat(precision.toFixed(1)),
        evaluaciones_realizadas: confirmaciones.length,
      });
    }

    precisiones.sort((a, b) => b.precision - a.precision);

    return precisiones;
  }
}