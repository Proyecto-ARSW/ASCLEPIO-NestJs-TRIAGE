// src/modules/cola/services/cola.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RedisService } from './redis.service';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  ItemCola,
  ColaResumen,
  ColaPorHospital,
} from '../interfaces/item-cola.interface';
import { EstadisticasCola } from '../interfaces/estadisticas-cola.interface';

@Injectable()
export class ColaService {
  private readonly logger = new Logger(ColaService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Agrega un turno a la cola priorizada
   * Key pattern: hospital:{id}:cola:triage:{nivel}
   * Score = nivel * 1000000 + timestamp (para prioridad por nivel y luego por tiempo)
   */
  async agregarACola(
    turnoId: string,
    hospitalId: number,
    nivelTriage: number,
  ): Promise<number> {
    this.logger.log(
      `Agregando a cola - Turno: ${turnoId}, Hospital: ${hospitalId}, Nivel: ${nivelTriage}`,
    );

    const turno = await this.prisma.turnos.findUnique({
      where: { id: turnoId },
      include: {
        pacientes: true,  // ← Ya no incluir usuarios anidado
        nivel_triage: true,
      },
    });

    if (!turno || !turno.pacientes) {
      throw new NotFoundException('Turno no encontrado');
    }

    const timestamp = new Date(turno.creado_en).getTime();
    const score = nivelTriage * 1000000 + timestamp;
    const colaKey = `hospital:${hospitalId}:cola:triage:${nivelTriage}`;
    
    await this.redis.zadd(colaKey, score, turnoId);

    const metadataKey = `turno:${turnoId}`;
    await this.redis.hmset(metadataKey, {
      turno_id: turnoId,
      numero_turno: turno.numero_turno.toString(),
      paciente_id: turno.paciente_id,
      // Obtener nombre del paciente desde la tabla usuarios separadamente
      nivel_triage: nivelTriage.toString(),
      hospital_id: hospitalId.toString(),
      ingreso_cola: new Date().toISOString(),
      alerta_critica: (nivelTriage <= 2).toString(),
    });

    const posicion = await this.obtenerPosicionEnCola(turnoId, hospitalId, nivelTriage);

    this.logger.log(
      `Turno agregado a cola - Posición: ${posicion !== null ? posicion + 1 : 'N/A'} en nivel ${nivelTriage}`,
    );
    
    await this.publicarActualizacionCola(hospitalId);

    return posicion ?? 0;
  }

  /**
   * Remueve un turno de la cola (cuando es llamado)
   */
  async removerDeCola(
    turnoId: string,
    hospitalId: number,
    nivelTriage: number,
  ): Promise<void> {
    this.logger.log(
      `Removiendo de cola - Turno: ${turnoId}, Nivel: ${nivelTriage}`,
    );

    const colaKey = `hospital:${hospitalId}:cola:triage:${nivelTriage}`;
    const metadataKey = `turno:${turnoId}`;

    await this.redis.zrem(colaKey, turnoId);
    await this.redis.del(metadataKey);

    this.logger.log(`Turno removido de cola`);

    await this.publicarActualizacionCola(hospitalId);
  }

  /**
   * Obtiene la posición de un turno en la cola
   */
  async obtenerPosicionEnCola(
    turnoId: string,
    hospitalId: number,
    nivelTriage: number,
  ): Promise<number | null> {
    const colaKey = `hospital:${hospitalId}:cola:triage:${nivelTriage}`;
    const posicion = await this.redis.zrank(colaKey, turnoId);

    return posicion;
  }

  /**
   * Obtiene todos los turnos en espera de un hospital
   */
  async obtenerColaPorHospital(hospitalId: number): Promise<ColaPorHospital> {
    this.logger.debug(`Obteniendo cola del hospital ${hospitalId}`);

    const hospital = await this.prisma.hospitales.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundException('Hospital no encontrado');
    }

    const niveles: { [key: number]: ColaResumen } = {};
    let totalEnEspera = 0;

    for (let nivel = 1; nivel <= 5; nivel++) {
      const colaKey = `hospital:${hospitalId}:cola:triage:${nivel}`;

      const turnoIds = await this.redis.zrange(colaKey, 0, -1);
      totalEnEspera += turnoIds.length;

      const items: ItemCola[] = [];
      let tiempoTotal = 0;

      for (const turnoId of turnoIds) {
        const metadata = await this.obtenerMetadataTurno(turnoId);
        
        if (metadata) {
          items.push(metadata);
          tiempoTotal += metadata.tiempo_espera_minutos;
        }
      }

      niveles[nivel] = {
        nivel,
        total: turnoIds.length,
        tiempo_espera_promedio: turnoIds.length > 0 ? tiempoTotal / turnoIds.length : 0,
        items,
      };
    }

    return {
      hospital_id: hospitalId,
      hospital_nombre: hospital.nombre,
      total_en_espera: totalEnEspera,
      niveles,
      actualizado_en: new Date().toISOString(),
    };
  }

  /**
   * Obtiene la cola de un nivel específico
   */
  async obtenerColaPorNivel(
    hospitalId: number,
    nivelTriage: number,
  ): Promise<ColaResumen> {
    const colaKey = `hospital:${hospitalId}:cola:triage:${nivelTriage}`;

    const turnoIds = await this.redis.zrange(colaKey, 0, -1);

    const items: ItemCola[] = [];
    let tiempoTotal = 0;

    for (const turnoId of turnoIds) {
      const metadata = await this.obtenerMetadataTurno(turnoId);
      
      if (metadata) {
        items.push(metadata);
        tiempoTotal += metadata.tiempo_espera_minutos;
      }
    }

    return {
      nivel: nivelTriage,
      total: turnoIds.length,
      tiempo_espera_promedio: turnoIds.length > 0 ? tiempoTotal / turnoIds.length : 0,
      items,
    };
  }

  /**
   * Obtiene el siguiente turno a atender (prioridad más alta)
   */
  async obtenerSiguienteTurno(hospitalId: number): Promise<ItemCola | null> {
    for (let nivel = 1; nivel <= 5; nivel++) {
      const colaKey = `hospital:${hospitalId}:cola:triage:${nivel}`;

      const turnoIds = await this.redis.zrange(colaKey, 0, 0);

      if (turnoIds.length > 0) {
        const metadata = await this.obtenerMetadataTurno(turnoIds[0]);
        return metadata;
      }
    }

    return null;
  }

  /**
   * Obtiene estadísticas de la cola
   */
  async obtenerEstadisticas(hospitalId: number): Promise<EstadisticasCola> {
    const cola = await this.obtenerColaPorHospital(hospitalId);

    const porNivel = {
      nivel_1: cola.niveles[1]?.total || 0,
      nivel_2: cola.niveles[2]?.total || 0,
      nivel_3: cola.niveles[3]?.total || 0,
      nivel_4: cola.niveles[4]?.total || 0,
      nivel_5: cola.niveles[5]?.total || 0,
    };

    let tiempoTotal = 0;
    let tiempoMax = 0;
    let totalPacientes = 0;

    Object.values(cola.niveles).forEach((nivel) => {
      nivel.items.forEach((item) => {
        tiempoTotal += item.tiempo_espera_minutos;
        if (item.tiempo_espera_minutos > tiempoMax) {
          tiempoMax = item.tiempo_espera_minutos;
        }
        totalPacientes++;
      });
    });

    const tiempoPromedio = totalPacientes > 0 ? tiempoTotal / totalPacientes : 0;

    const alertasActivas = porNivel.nivel_1 + porNivel.nivel_2;

    // TODO: Implementar tendencia última hora (requiere histórico)
    const tendencia = {
      ingresos: 0,
      atendidos: 0,
      promedio_atencion_min: 0,
    };

    return {
      hospital_id: hospitalId,
      total_en_cola: cola.total_en_espera,
      por_nivel: porNivel,
      tiempo_espera_promedio_min: tiempoPromedio,
      tiempo_espera_maximo_min: tiempoMax,
      alertas_activas: alertasActivas,
      tendencia_ultima_hora: tendencia,
    };
  }

  /**
   * Limpia la cola de un hospital (para testing o mantenimiento)
   */
  async limpiarCola(hospitalId: number): Promise<void> {
    this.logger.warn(`Limpiando cola del hospital ${hospitalId}`);

    for (let nivel = 1; nivel <= 5; nivel++) {
      const colaKey = `hospital:${hospitalId}:cola:triage:${nivel}`;
      const turnoIds = await this.redis.zrange(colaKey, 0, -1);

      // Remover metadata de cada turno
      for (const turnoId of turnoIds) {
        await this.redis.del(`turno:${turnoId}`);
      }

      // Remover sorted set completo
      await this.redis.del(colaKey);
    }

    this.logger.log(`Cola limpiada`);
  }

  /**
   * Obtiene metadata de un turno desde Redis
   */
  private async obtenerMetadataTurno(turnoId: string): Promise<ItemCola | null> {
    const metadataKey = `turno:${turnoId}`;
    const metadata = await this.redis.hgetall(metadataKey);

    if (!metadata || Object.keys(metadata).length === 0) {
      return null;
    }

    // Obtener nombre del paciente desde la BD si no está en Redis
    let pacienteNombre = metadata.paciente_nombre || 'N/A';
    let pacienteApellido = metadata.paciente_apellido || 'N/A';

    if (!metadata.paciente_nombre && metadata.paciente_id) {
      const paciente = await this.prisma.pacientes.findUnique({
        where: { id: metadata.paciente_id },
      });
      
      if (paciente) {
        const usuario = await this.prisma.usuarios.findUnique({
          where: { id: paciente.usuario_id },
        });
        
        if (usuario) {
          pacienteNombre = usuario.nombre;
          pacienteApellido = usuario.apellido;
        }
      }
    }

    const ingresoCola = new Date(metadata.ingreso_cola);
    const ahora = new Date();
    const tiempoEsperaMs = ahora.getTime() - ingresoCola.getTime();
    const tiempoEsperaMin = Math.floor(tiempoEsperaMs / 60000);

    return {
      turno_id: metadata.turno_id,
      numero_turno: parseInt(metadata.numero_turno),
      paciente_id: metadata.paciente_id,
      paciente_nombre: pacienteNombre,
      paciente_apellido: pacienteApellido,
      nivel_triage: parseInt(metadata.nivel_triage),
      tiempo_espera_minutos: tiempoEsperaMin,
      prioridad_score: parseInt(metadata.nivel_triage) * 1000000,
      creado_en: metadata.ingreso_cola,
      alerta_critica: metadata.alerta_critica === 'true',
    };
  }

  /**
   * Publica actualización de cola para WebSocket
   */
  private async publicarActualizacionCola(hospitalId: number): Promise<void> {
    const channel = `hospital:${hospitalId}:cola:actualizada`;
    const mensaje = JSON.stringify({
      hospital_id: hospitalId,
      timestamp: new Date().toISOString(),
    });

    await this.redis.publish(channel, mensaje);
  }
}