// src/modules/websockets/gateways/triage.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { WsCurrentUser } from '../decorators/ws-current-user.decorator';
import { AuthenticatedSocket } from '../interfaces/socket-client.interface';
import {
  ServerEvents,
  ClientEvents,
  TurnoEventPayload,
  EvaluacionCompletadaEventPayload,
  VitalesEventPayload,
  TriageConfirmadoEventPayload,
  ColaEventPayload,
  PacienteLlamadoEventPayload,
  AlertaCriticaEventPayload,
  NotificacionEventPayload,
} from '../interfaces/socket-events.interface';
import { RedisService } from 'src/modules/cola/services/redis.service';

@WebSocketGateway({
  namespace: '/triage',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class TriageGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TriageGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('🔌 WebSocket Gateway inicializado');
    this.suscribirseAEventosRedis();
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`Cliente intentó conectar sin token - ID: ${client.id}`);
        client.disconnect();
        return;
      }

      this.logger.log(`Cliente conectado - ID: ${client.id} - IP: ${client.handshake.address}`);

      client.emit('connected', {
        message: 'Conectado exitosamente al servidor de triage',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.error(`Error en conexión: ${error?.message || error}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(
      `Cliente desconectado - ID: ${client.id} - Usuario: ${client.user?.email || 'Desconocido'}`,
    );
  }

  @SubscribeMessage(ClientEvents.JOIN_HOSPITAL)
  @UseGuards(WsAuthGuard)
  async handleJoinHospital(
    @MessageBody() data: { hospital_id: number; rol: string },
    @ConnectedSocket() client: AuthenticatedSocket,
    @WsCurrentUser() user: any,
  ) {
    const room = `hospital:${data.hospital_id}`;

    await client.join(room);
    client.hospital_id = data.hospital_id;

    this.logger.log(`Usuario ${user.email} (${user.rol}) se unió a hospital ${data.hospital_id}`);

    client.emit('joined:hospital', {
      hospital_id: data.hospital_id,
      room,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage(ClientEvents.LEAVE_HOSPITAL)
  @UseGuards(WsAuthGuard)
  async handleLeaveHospital(
    @MessageBody() data: { hospital_id: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const room = `hospital:${data.hospital_id}`;

    await client.leave(room);
    client.hospital_id = undefined;

    this.logger.log(`Usuario salió de hospital ${data.hospital_id}`);

    client.emit('left:hospital', {
      hospital_id: data.hospital_id,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage(ClientEvents.JOIN_DASHBOARD_ENFERMERO)
  @UseGuards(WsAuthGuard)
  async handleJoinDashboardEnfermero(
    @MessageBody() data: { hospital_id: number },
    @ConnectedSocket() client: AuthenticatedSocket,
    @WsCurrentUser() user: any,
  ) {
    if (user.rol !== 'ENFERMERO' && user.rol !== 'ADMIN') {
      client.emit('error', {
        message: 'No tienes permisos para acceder al dashboard de enfermería',
      });
      return;
    }

    const room = `dashboard:enfermero:${data.hospital_id}`;
    await client.join(room);
    client.dashboard_type = 'enfermero';

    this.logger.log(`Enfermero ${user.email} se unió al dashboard - Hospital: ${data.hospital_id}`);

    client.emit('joined:dashboard-enfermero', {
      hospital_id: data.hospital_id,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage(ClientEvents.JOIN_DASHBOARD_MEDICO)
  @UseGuards(WsAuthGuard)
  async handleJoinDashboardMedico(
    @MessageBody() data: { hospital_id: number },
    @ConnectedSocket() client: AuthenticatedSocket,
    @WsCurrentUser() user: any,
  ) {
    if (user.rol !== 'MEDICO' && user.rol !== 'JEFE_GUARDIA' && user.rol !== 'ADMIN') {
      client.emit('error', {
        message: 'No tienes permisos para acceder al dashboard médico',
      });
      return;
    }

    const room = `dashboard:medico:${data.hospital_id}`;
    await client.join(room);
    client.dashboard_type = 'medico';

    this.logger.log(`Médico ${user.email} se unió al dashboard - Hospital: ${data.hospital_id}`);

    client.emit('joined:dashboard-medico', {
      hospital_id: data.hospital_id,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage(ClientEvents.JOIN_PANTALLA_LLAMADOS)
  async handleJoinPantallaLlamados(
    @MessageBody() data: { hospital_id: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const room = `pantalla:llamados:${data.hospital_id}`;
    await client.join(room);
    client.dashboard_type = 'pantalla';

    this.logger.log(`Pantalla de llamados conectada - Hospital: ${data.hospital_id}`);

    client.emit('joined:pantalla-llamados', {
      hospital_id: data.hospital_id,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage(ClientEvents.PING)
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }


  /**
   * Emite evento a un hospital específico
   */
  emitToHospital(hospitalId: number, event: string, payload: any) {
    const room = `hospital:${hospitalId}`;
    this.server.to(room).emit(event, payload);
    this.logger.debug(`Evento ${event} emitido a hospital ${hospitalId}`);
  }

  /**
   * Emite evento a un paciente específico (por turno_id)
   */
  emitToPaciente(turnoId: string, event: string, payload: any) {
    const room = `turno:${turnoId}`;
    this.server.to(room).emit(event, payload);
    this.logger.debug(`Evento ${event} emitido a turno ${turnoId}`);
  }

  /**
   * Emite evento al dashboard de enfermeros
   */
  emitToDashboardEnfermeros(hospitalId: number, event: string, payload: any) {
    const room = `dashboard:enfermero:${hospitalId}`;
    this.server.to(room).emit(event, payload);
    this.logger.debug(`Evento ${event} emitido a dashboard enfermeros - Hospital ${hospitalId}`);
  }

  /**
   * Emite evento al dashboard de médicos
   */
  emitToDashboardMedicos(hospitalId: number, event: string, payload: any) {
    const room = `dashboard:medico:${hospitalId}`;
    this.server.to(room).emit(event, payload);
    this.logger.debug(`Evento ${event} emitido a dashboard médicos - Hospital ${hospitalId}`);
  }

  /**
   * Emite evento cuando se crea un turno
   */
  emitTurnoCreado(payload: TurnoEventPayload) {
    const room = `hospital:${payload.hospital_id}`;
    this.server.to(room).emit(ServerEvents.TURNO_CREADO, payload);
    this.logger.debug(`Evento ${ServerEvents.TURNO_CREADO} emitido - Turno: ${payload.numero_turno}`);
  }

  /**
   * Emite evento cuando se completa el cuestionario/evaluación
   */
  emitCuestionarioCompletado(payload: EvaluacionCompletadaEventPayload, hospitalId: number) {
    const room = `hospital:${hospitalId}`;
    const dashboardEnfermero = `dashboard:enfermero:${hospitalId}`;

    this.server.to(room).emit(ServerEvents.EVALUACION_COMPLETADA, payload);
    this.server.to(dashboardEnfermero).emit(ServerEvents.EVALUACION_COMPLETADA, payload);

    this.logger.debug(`Evento ${ServerEvents.EVALUACION_COMPLETADA} emitido`);
  }

  /**
   * Emite evento cuando se registran vitales
   */
  emitVitalesRegistrados(payload: VitalesEventPayload, hospitalId: number) {
    const room = `hospital:${hospitalId}`;
    const dashboardEnfermero = `dashboard:enfermero:${hospitalId}`;

    this.server.to(room).emit(ServerEvents.VITALES_REGISTRADOS, payload);
    this.server.to(dashboardEnfermero).emit(ServerEvents.VITALES_REGISTRADOS, payload);

    this.logger.debug(`Evento ${ServerEvents.VITALES_REGISTRADOS} emitido`);
  }

  /**
   * Emite evento cuando se confirma el triage
   */
  emitTriageConfirmado(payload: TriageConfirmadoEventPayload, hospitalId: number) {
    const room = `hospital:${hospitalId}`;
    const dashboardEnfermero = `dashboard:enfermero:${hospitalId}`;
    const dashboardMedico = `dashboard:medico:${hospitalId}`;

    this.server.to(room).emit(ServerEvents.TRIAGE_CONFIRMADO, payload);
    this.server.to(dashboardEnfermero).emit(ServerEvents.TRIAGE_CONFIRMADO, payload);
    this.server.to(dashboardMedico).emit(ServerEvents.TRIAGE_CONFIRMADO, payload);

    this.logger.debug(`Evento ${ServerEvents.TRIAGE_CONFIRMADO} emitido`);
  }

  /**
   * Emite evento cuando se actualiza la cola
   */
  emitColaActualizada(payload: ColaEventPayload) {
    const room = `hospital:${payload.hospital_id}`;
    const dashboardMedico = `dashboard:medico:${payload.hospital_id}`;

    this.server.to(room).emit(ServerEvents.COLA_ACTUALIZADA, payload);
    this.server.to(dashboardMedico).emit(ServerEvents.COLA_ACTUALIZADA, payload);

    this.logger.debug(`Evento ${ServerEvents.COLA_ACTUALIZADA} emitido`);
  }

  /**
   * Emite evento cuando un médico llama a un paciente
   */
  emitPacienteLlamado(payload: PacienteLlamadoEventPayload, hospitalId: number) {
    const room = `hospital:${hospitalId}`;
    const pantallaLlamados = `pantalla:llamados:${hospitalId}`;

    this.server.to(room).emit(ServerEvents.PACIENTE_LLAMADO, payload);
    this.server.to(pantallaLlamados).emit(ServerEvents.PANTALLA_LLAMAR, payload);

    this.logger.debug(
      `Evento ${ServerEvents.PACIENTE_LLAMADO} emitido - Turno: ${payload.numero_turno} → Consultorio: ${payload.consultorio}`,
    );
  }

  /**
   * Emite evento de alerta crítica
   */
  emitAlertaCritica(payload: AlertaCriticaEventPayload, hospitalId: number) {
    const dashboardMedico = `dashboard:medico:${hospitalId}`;

    this.server.to(dashboardMedico).emit(ServerEvents.ALERTA_CRITICA, payload);

    this.logger.warn(`Evento ${ServerEvents.ALERTA_CRITICA} emitido - Nivel: ${payload.nivel_triage}`);
  }

  /**
   * Emite notificación general
   */
  emitNotificacion(payload: NotificacionEventPayload, hospitalId: number, room?: string) {
    const targetRoom = room || `hospital:${hospitalId}`;

    this.server.to(targetRoom).emit(ServerEvents.NOTIFICACION, payload);

    this.logger.debug(`Notificación emitida: ${payload.titulo}`);
  }

    /**
   * Suscribe el gateway a eventos de Redis Pub/Sub
   */
  private async suscribirseAEventosRedis() {
    this.logger.log('Suscribiéndose a eventos de Redis Pub/Sub...');

    await this.redis.psubscribe('hospital:*:cola:actualizada', (channel, mensaje) => {
      try {
        const data = JSON.parse(mensaje);
        this.emitColaActualizada({
          hospital_id: data.hospital_id,
          total_en_espera: data.total_en_espera || 0,
          timestamp: data.timestamp,
        });
      } catch (error: any) {
        this.logger.error(`Error procesando evento Redis: ${error?.message || error}`);
      }
    });

    await this.redis.psubscribe('hospital:*:alerta:critica', (channel, mensaje) => {
      try {
        const data = JSON.parse(mensaje);
        this.emitAlertaCritica(data, data.hospital_id);
      } catch (error: any) {
        this.logger.error(`Error procesando alerta Redis: ${error?.message || error}`);
      }
    });

    this.logger.log('Suscripciones a Redis Pub/Sub activas');
  }


  private extractToken(client: AuthenticatedSocket): string | undefined {
    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer') return token;
    }

    const queryToken = client.handshake?.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    const authToken = client.handshake?.auth?.token;
    if (authToken) return authToken;

    return undefined;
  }
}