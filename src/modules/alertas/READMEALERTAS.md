# Módulo Alertas

Gestión de alertas críticas en tiempo real para pacientes de nivel 1-2 con GraphQL Subscriptions.

## Tipos de alertas

### 1. Alertas Críticas (alertas_criticas)
Generadas cuando:
- Se confirma un nivel 1-2 en triage
- Se detecta nivel 1 en cuestionario preliminar
- Una alerta crítica se escala al jefe de guardia

**Tipos:**
- `TRIAGE_CRITICO`: Nivel 1-2 confirmado
- `TRIAGE_CRITICO_PRELIMINAR`: Nivel 1 detectado en cuestionario
- `TRIAGE_ESCALADO`: Alerta escalada por timeout

### 2. Alertas de Tiempo de Espera (alertas_triage)
Generadas cuando un paciente excede el tiempo máximo de espera:
- Nivel 1: 0 min (inmediato)
- Nivel 2: 10 min
- Nivel 3: 60 min
- Nivel 4: 120 min
- Nivel 5: 240 min

## Flujo de alertas críticas
```
1. Confirmación de triage (nivel 1-2)
   ↓
2. AlertaCriticaService.crearAlerta()
   ↓
3. Guardar en PostgreSQL
   ↓
4. Publicar en Redis Pub/Sub
   ↓
5. GraphQL Subscription emite evento
   ↓
6. Frontend muestra modal roja bloqueante
   ↓
7. Médico confirma en 3 minutos → OK
   O
   Médico NO confirma → Escalamiento automático al jefe de guardia
```

## GraphQL Subscriptions

### triageCritico
Notifica cuando se crea una alerta crítica de nivel 1-2.
```graphql
subscription {
  triageCritico(hospital_id: 1) {
    id
    turno {
      numero_turno
      paciente {
        nombre
        apellido
      }
    }
    nivel_triage
    tipo_alerta
    creado_en
  }
}
```

**Frontend:** Modal roja bloqueante que obliga al médico a confirmar.

### triageEscalado
Notifica al jefe de guardia cuando una alerta se escala automáticamente.
```graphql
subscription {
  triageEscalado(hospital_id: 1) {
    id
    turno_id
    nivel_triage
    escalada_en
    escalada_a
    razon_escalamiento
  }
}
```

### alertaConfirmada
Notifica cuando un médico confirma una alerta (para cerrar modales).
```graphql
subscription {
  alertaConfirmada(hospital_id: 1) {
    id
    confirmada
    confirmada_por
    confirmada_en
  }
}
```

## Mutations

### crearAlertaCritica
```graphql
mutation {
  crearAlertaCritica(input: {
    turno_id: "uuid"
    hospital_id: 1
    nivel_triage: 1
    tipo_alerta: TRIAGE_CRITICO
  }) {
    id
    tipo_alerta
    activa
  }
}
```

### confirmarAlertaCritica
```graphql
mutation {
  confirmarAlertaCritica(input: {
    alerta_id: "uuid"
    medico_id: "uuid"
  }) {
    id
    confirmada
    confirmada_en
    confirmada_por
  }
}
```

## REST Endpoints

### POST /api/triage/alertas/critica
Crea una alerta crítica.

### PUT /api/triage/alertas/:id/confirmar
Confirma una alerta (médico acepta atender).

### PUT /api/triage/alertas/:id/escalar
Escala una alerta al jefe de guardia.

### GET /api/triage/alertas/hospital/:hospital_id
Obtiene todas las alertas activas de un hospital.

### POST /api/triage/alertas/escalamiento/procesar
Procesa escalamiento automático (llamado por cron cada minuto).

## Escalamiento automático

Un **cron job** se ejecuta cada minuto:
```typescript
// En main.ts o un módulo de tareas programadas
import { Cron, CronExpression } from '@nestjs/schedule';

@Cron(CronExpression.EVERY_MINUTE)
async procesarEscalamientos() {
  await this.escalamientoService.procesarEscalamientoAutomatico();
}
```

Lógica:
1. Busca alertas activas no confirmadas creadas hace >3 minutos
2. Para cada alerta:
   - Obtiene jefe de guardia del hospital
   - Escala la alerta
   - Publica GraphQL Subscription `triageEscalado`
   - Envía notificación push/email (TODO)

## Integración con otros módulos

### Cuestionario
```typescript
// Si nivel preliminar = 1
if (resultadoIA.nivel_sugerido === 1) {
  await alertaCriticaService.crearAlerta({
    turno_id,
    hospital_id,
    nivel_triage: 1,
    tipo_alerta: TipoAlerta.TRIAGE_CRITICO_PRELIMINAR
  });
}
```

### Confirmación
```typescript
// Si nivel final = 1-2
if (dto.nivel_final_enfermero <= 2) {
  await alertaCriticaService.crearAlerta({
    turno_id,
    hospital_id,
    nivel_triage: dto.nivel_final_enfermero,
    tipo_alerta: TipoAlerta.TRIAGE_CRITICO
  });
}
```

### Turnos
```typescript
// Cuando paciente es atendido
await alertaCriticaService.desactivarAlerta(turno_id);
```

## Testing GraphQL Subscriptions
```bash
# En GraphQL Playground (http://localhost:3001/graphql)

# Pestaña 1: Subscription
subscription {
  triageCritico(hospital_id: 1) {
    id
    nivel_triage
    turno {
      numero_turno
    }
  }
}

# Pestaña 2: Mutation (para probar)
mutation {
  crearAlertaCritica(input: {
    turno_id: "uuid-turno"
    hospital_id: 1
    nivel_triage: 1
    tipo_alerta: TRIAGE_CRITICO
  }) {
    id
  }
}

# La subscription en Pestaña 1 recibirá el evento en tiempo real
```

## Variables de entorno

No requiere variables adicionales. Usa Redis del módulo ColaModule.

## TODO - Mejoras futuras

- [ ] Enviar notificaciones push a médicos (Firebase)
- [ ] Enviar emails/SMS al jefe de guardia en escalamientos
- [ ] Dashboard de métricas de alertas (tiempo respuesta, tasa confirmación)
- [ ] Integración con sistema de paging del hospital
- [ ] Alertas de vitales anormales en tiempo real