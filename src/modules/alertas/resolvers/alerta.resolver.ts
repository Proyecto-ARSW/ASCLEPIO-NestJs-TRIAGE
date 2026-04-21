// src/modules/alertas/resolvers/alerta.resolver.ts

import { Resolver, Query, Mutation, Subscription, Args, Int } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { Inject, UseGuards, Logger } from '@nestjs/common';
import { AlertaCriticaService } from '../services/alerta-critica.service';
import { EscalamientoService } from '../services/escalamiento.service';
import { AlertaCritica } from '../entities/alerta-critica.entity';
import { CrearAlertaCriticaDto } from '../dto/crear-alerta-critica.dto';
import { ConfirmarAlertaDto } from '../dto/confirmar-alerta.dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

const pubSub = new PubSub();

export const ALERTA_CRITICA_TOPIC = 'ALERTA_CRITICA_CREADA';
export const ALERTA_ESCALADA_TOPIC = 'ALERTA_ESCALADA';
export const ALERTA_CONFIRMADA_TOPIC = 'ALERTA_CONFIRMADA';

@Resolver(() => AlertaCritica)
export class AlertaResolver {
  private readonly logger = new Logger(AlertaResolver.name);

  constructor(
    private readonly alertaCriticaService: AlertaCriticaService,
    private readonly escalamientoService: EscalamientoService,
  ) {}


  @Query(() => [AlertaCritica], { name: 'alertasActivasHospital' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('MEDICO', 'JEFE_GUARDIA', 'ADMIN')
  async getAlertasActivas(
    @Args('hospital_id', { type: () => Int }) hospitalId: number,
  ): Promise<AlertaCritica[]> {
    return this.alertaCriticaService.obtenerAlertasActivas(hospitalId);
  }

  @Query(() => AlertaCritica, { name: 'alertaCritica' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('MEDICO', 'JEFE_GUARDIA', 'ADMIN')
  async getAlertaCritica(
    @Args('alerta_id') alertaId: string,
  ): Promise<AlertaCritica> {
    return this.alertaCriticaService.obtenerPorId(alertaId);
  }

  @Mutation(() => AlertaCritica, { name: 'crearAlertaCritica' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ENFERMERO', 'ADMIN')
  async crearAlerta(
    @Args('input') input: CrearAlertaCriticaDto,
  ): Promise<AlertaCritica> {
    this.logger.log(`GraphQL Mutation: Crear alerta crítica`);

    const resultado = await this.alertaCriticaService.crearAlerta(input);
    await pubSub.publish(ALERTA_CRITICA_TOPIC, {
      triageCritico: resultado.alerta,
      hospital_id: input.hospital_id,
    });

    return resultado.alerta;
  }

  @Mutation(() => AlertaCritica, { name: 'confirmarAlertaCritica' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('MEDICO', 'JEFE_GUARDIA')
  async confirmarAlerta(
    @Args('input') input: ConfirmarAlertaDto,
  ): Promise<AlertaCritica> {
    this.logger.log(
      `GraphQL Mutation: Confirmar alerta ${input.alerta_id} - Médico: ${input.medico_id}`,
    );

    const alerta = await this.alertaCriticaService.confirmarAlerta(input);

    await pubSub.publish(ALERTA_CONFIRMADA_TOPIC, {
      alertaConfirmada: alerta,
      hospital_id: alerta.hospital_id,
    });

    return alerta;
  }

  /**
   * Subscription: Alertas críticas en tiempo real
   * Frontend se subscribe para mostrar modal roja bloqueante
   */
  @Subscription(() => AlertaCritica, {
    name: 'triageCritico',
    filter: (payload, variables) => {
      return payload.hospital_id === variables.hospital_id;
    },
  })
  triageCritico(@Args('hospital_id', { type: () => Int }) hospitalId: number) {
    this.logger.log(`GraphQL Subscription: triageCritico - Hospital: ${hospitalId}`);

    return pubSub.asyncIterator(ALERTA_CRITICA_TOPIC);
  }

  /**
   * Subscription: Alertas escaladas al jefe de guardia
   */
  @Subscription(() => AlertaCritica, {
    name: 'triageEscalado',
    filter: (payload, variables) => {
      return (
        payload.hospital_id === variables.hospital_id &&
        payload.triageEscalado.escalada
      );
    },
  })
  triageEscalado(@Args('hospital_id', { type: () => Int }) hospitalId: number) {
    this.logger.log(`GraphQL Subscription: triageEscalado - Hospital: ${hospitalId}`);

    return pubSub.asyncIterator(ALERTA_ESCALADA_TOPIC);
  }

  /**
   * Subscription: Alertas confirmadas (para cerrar modales)
   */
  @Subscription(() => AlertaCritica, {
    name: 'alertaConfirmada',
    filter: (payload, variables) => {
      return payload.hospital_id === variables.hospital_id;
    },
  })
  alertaConfirmada(@Args('hospital_id', { type: () => Int }) hospitalId: number) {
    this.logger.log(
      `GraphQL Subscription: alertaConfirmada - Hospital: ${hospitalId}`,
    );

    return pubSub.asyncIterator(ALERTA_CONFIRMADA_TOPIC);
  }
}

export class AlertaPubSub {
  static async publicarAlertaCritica(alerta: AlertaCritica, hospitalId: number) {
    await pubSub.publish(ALERTA_CRITICA_TOPIC, {
      triageCritico: alerta,
      hospital_id: hospitalId,
    });
  }

  static async publicarAlertaEscalada(alerta: AlertaCritica, hospitalId: number) {
    await pubSub.publish(ALERTA_ESCALADA_TOPIC, {
      triageEscalado: alerta,
      hospital_id: hospitalId,
    });
  }

  static async publicarAlertaConfirmada(alerta: AlertaCritica, hospitalId: number) {
    await pubSub.publish(ALERTA_CONFIRMADA_TOPIC, {
      alertaConfirmada: alerta,
      hospital_id: hospitalId,
    });
  }
}