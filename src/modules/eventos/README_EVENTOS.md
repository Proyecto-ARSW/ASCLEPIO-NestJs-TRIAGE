# Módulo Eventos (RabbitMQ)

Sistema de comunicación asíncrona entre microservicios usando RabbitMQ con patrón Publisher/Subscriber.

## Arquitectura
```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE EVENTOS RABBITMQ                     │
└─────────────────────────────────────────────────────────────────┘

ASCLEPIO-TRIAGE (Publisher)
  ↓
  ↓ Publica evento: "triage.paciente.atendido"
  ↓
RabbitMQ Exchange (Topic): "asclepio_exchange"
  ↓
  ├─→ ASCLEPIO-CORE (Consumer)
  │   └─→ Crea registro en historial_medico
  │
  ├─→ ASCLEPIO-FARMACIA (Consumer)
  │   └─→ Prepara orden de medicamentos
  │
  └─→ ANALYTICS-SERVICE (Consumer)
      └─→ Actualiza métricas en tiempo real
```

## Patrón de Comunicación

### Topic Exchange
Usado para routing flexible basado en patrones de routing keys:
```
Exchange: "asclepio_exchange"
Type: "topic"

Routing Keys:
  - triage.* → Todos los eventos de triage
  - triage.paciente.* → Solo eventos de pacientes
  - triage.alerta.* → Solo eventos de alertas
  - core.* → Eventos de asclepio-core
  - farmacia.* → Eventos de asclepio-farmacia
```

### Dead Letter Queue (DLQ)
Para mensajes que fallan después de reintentos:
```
Queue: "triage_events.dlq"
Exchange: "asclepio_exchange.dlx"
TTL: 24 horas
```

## Eventos Publicados por ASCLEPIO-TRIAGE

| Evento | Routing Key | Cuándo se emite | Consumidores típicos |
|--------|-------------|-----------------|---------------------|
| Turno creado | `triage.turno.creado` | Al crear un turno | Analytics, Notificaciones |
| Cuestionario completado | `triage.cuestionario.completado` | Paciente completa cuestionario | Analytics |
| Vitales registrados | `triage.vitales.registrados` | Enfermero registra vitales | Analytics |
| Triage confirmado | `triage.confirmado` | Enfermero confirma nivel | Core, Analytics |
| Paciente llamado | `triage.paciente.llamado` | Médico llama paciente | Notificaciones |
| Paciente atendido | `triage.paciente.atendido` | Médico finaliza consulta | Core, Farmacia, Analytics |
| Alerta crítica | `triage.alerta.critica.creada` | Nivel 1-2 detectado | Notificaciones, Alertas |
| Alerta escalada | `triage.alerta.escalada` | Timeout sin confirmar | Notificaciones |

## Eventos Consumidos por ASCLEPIO-TRIAGE

| Evento | Routing Key | De dónde viene | Qué hace |
|--------|-------------|----------------|----------|
| Paciente creado | `core.paciente.creado` | asclepio-core | Sincroniza datos |
| Paciente actualizado | `core.paciente.actualizado` | asclepio-core | Invalida caché |
| Médico asignado | `core.medico.asignado` | asclepio-core | Actualiza disponibilidad |
| Orden creada | `farmacia.orden.creada` | asclepio-farmacia | Notifica paciente |

## Estructura de un Evento

Todos los eventos siguen esta estructura:
```typescript
interface BaseEvent<T> {
  event_type: string;           // "triage.paciente.atendido"
  event_id: string;             // UUID único del evento
  timestamp: string;            // ISO 8601
  service: string;              // "asclepio-triage"
  version: string;              // "1.0.0"
  payload: T;                   // Datos específicos del evento
  metadata?: {
    correlation_id?: string;    // Para tracing distribuido
    causation_id?: string;      // ID del evento que causó este
    user_id?: string;           // Usuario que generó el evento
    hospital_id?: number;       // Hospital relacionado
  };
}
```

### Ejemplo de Evento Completo
```json
{
  "event_type": "triage.paciente.atendido",
  "event_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "timestamp": "2026-03-22T15:30:45.123Z",
  "service": "asclepio-triage",
  "version": "1.0.0",
  "payload": {
    "turno_id": "abc123",
    "numero_turno": 42,
    "hospital_id": 1,
    "paciente_id": "def456",
    "medico_id": "ghi789",
    "nivel_triage": 3,
    "tiempo_espera_minutos": 25,
    "tiempo_atencion_minutos": 15,
    "diagnostico": "Gastroenteritis aguda",
    "tratamiento": "Hidratación oral + Omeprazol",
    "observaciones": "Control en 48 horas"
  },
  "metadata": {
    "correlation_id": "jkl012",
    "user_id": "medico-123",
    "hospital_id": 1
  }
}
```

## Uso - Publisher

### Publicar un evento
```typescript
// En cualquier service
constructor(
  private readonly eventPublisher: TriageEventPublisher,
) {}

async finalizarTurno(turnoId: string, dto: FinalizarTurnoDto) {
  // 1. Actualizar BD
  const turno = await this.prisma.turnos.update({...});

  // 2. Publicar evento
  await this.eventPublisher.publishPacienteAtendido({
    turno_id: turno.id,
    numero_turno: turno.numero_turno,
    hospital_id: turno.hospital_id,
    paciente_id: turno.paciente_id,
    medico_id: dto.medico_id,
    nivel_triage: turno.nivel_triage_id,
    tiempo_espera_minutos: calcularTiempoEspera(turno),
    tiempo_atencion_minutos: calcularTiempoAtencion(turno),
    diagnostico: dto.diagnostico,
    tratamiento: dto.tratamiento,
    observaciones: dto.observaciones,
  });

  return turno;
}
```

## Uso - Consumer

### Consumir eventos de otros servicios
```typescript
// En core-event.consumer.ts
protected async handleEvent(event: BaseEvent): Promise<void> {
  switch (event.event_type) {
    case CoreEventType.PACIENTE_CREADO:
      await this.handlePacienteCreado(event.payload);
      break;
    
    // ...
  }
}

private async handlePacienteCreado(payload: PacienteCreadoPayload) {
  this.logger.log(`Nuevo paciente: ${payload.nombre} ${payload.apellido}`);
  
  // Ejecutar lógica de negocio
  // await this.someService.processNewPatient(payload);
}
```

## Garantías de Entrega

### At-Least-Once Delivery
RabbitMQ garantiza que cada mensaje se entregue **al menos una vez**:

- **Persistent messages**: Los mensajes sobreviven reinicios del broker
- **Durable queues**: Las colas sobreviven reinicios del broker
- **Manual ACK**: El consumer debe confirmar explícitamente que procesó el mensaje

### Idempotencia
Los consumers **DEBEN** ser idempotentes porque un mensaje puede procesarse múltiples veces:
```typescript
// ❌ MAL - No idempotente
async handlePacienteCreado(payload: PacienteCreadoPayload) {
  await this.prisma.contadores.update({
    where: { nombre: 'total_pacientes' },
    data: { valor: { increment: 1 } }  // ← Problema si se procesa 2 veces
  });
}

// ✅ BIEN - Idempotente
async handlePacienteCreado(payload: PacienteCreadoPayload) {
  // Verificar si ya se procesó este evento
  const procesado = await this.prisma.eventos_procesados.findUnique({
    where: { event_id: payload.event_id }
  });
  
  if (procesado) {
    this.logger.debug(`Evento ya procesado: ${payload.event_id}`);
    return; // Skip
  }
  
  // Procesar + Marcar como procesado (en transacción)
  await this.prisma.$transaction([
    this.prisma.contadores.update({...}),
    this.prisma.eventos_procesados.create({
      event_id: payload.event_id,
      procesado_en: new Date()
    })
  ]);
}
```

## Retry Logic

### Reintentos automáticos
El consumer decide si reintentar un mensaje fallido:
```typescript
protected shouldRequeue(error: any): boolean {
  // Errores transitorios → Reintentar
  const transientErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
  
  if (transientErrors.some(err => error.message.includes(err))) {
    return true; // Requeue (vuelve a la cola)
  }

  // Errores de lógica/validación → Dead Letter Queue
  return false; // No requeue (enviar a DLQ)
}
```

### Dead Letter Queue
Mensajes que fallan repetidamente van a DLQ:
```bash
# Ver mensajes en DLQ
rabbitmqadmin get queue=triage_events.dlq count=10

# Reintentar mensajes manualmente
rabbitmqadmin get queue=triage_events.dlq requeue=true
```

## Monitoreo

### RabbitMQ Management UI
```
http://localhost:15672
Usuario: guest
Password: guest
```

Ver:
- Número de mensajes en cola
- Rate de publicación/consumo
- Mensajes no confirmados (unacked)
- DLQ size

### Logs
El módulo registra:
- ✅ Eventos publicados
- 📥 Eventos recibidos
- ❌ Errores de procesamiento
- ⚠️ Mensajes enviados a DLQ

### Métricas (TODO)
Implementar con Prometheus:
- `rabbitmq_messages_published_total`
- `rabbitmq_messages_consumed_total`
- `rabbitmq_messages_failed_total`
- `rabbitmq_processing_duration_seconds`

## Testing

### Publicar evento manualmente
```typescript
// test/eventos.e2e-spec.ts
describe('Eventos', () => {
  it('debe publicar evento de paciente atendido', async () => {
    const publisher = app.get(TriageEventPublisher);
    
    await publisher.publishPacienteAtendido({
      turno_id: 'test-123',
      numero_turno: 99,
      hospital_id: 1,
      paciente_id: 'pac-123',
      medico_id: 'med-123',
      nivel_triage: 3,
      tiempo_espera_minutos: 10,
      tiempo_atencion_minutos: 15,
      diagnostico: 'Test',
      tratamiento: 'Test',
    });
    
    // Verificar que se publicó
    // (requiere mock de RabbitMQ o usar testcontainers)
  });
});
```

### Consumer con RabbitMQ en Docker
```bash
# docker-compose.yml
rabbitmq:
  image: rabbitmq:3-management
  ports:
    - "5672:5672"
    - "15672:15672"
  environment:
    RABBITMQ_DEFAULT_USER: guest
    RABBITMQ_DEFAULT_PASS: guest
```

## Configuración

### Variables de entorno
```bash
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_EXCHANGE=asclepio_exchange
RABBITMQ_QUEUE_TRIAGE=triage_events
```

### Configuración avanzada
```typescript
// rabbitmq.config.ts
export default registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  exchange: process.env.RABBITMQ_EXCHANGE || 'asclepio_exchange',
  queue: process.env.RABBITMQ_QUEUE_TRIAGE || 'triage_events',
  prefetchCount: parseInt(process.env.RABBITMQ_PREFETCH, 10) || 10,
  heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT, 10) || 60,
}));
```

## Mejores Prácticas

1. **Eventos pequeños**: Solo datos esenciales (máximo 256KB)
2. **Idempotencia**: Los consumers deben poder procesar el mismo evento múltiples veces
3. **Versioning**: Incluir version en el evento para compatibilidad futura
4. **Correlation ID**: Para tracing distribuido
5. **Timeouts**: No procesar eventos por más de 30 segundos
6. **Logging**: Registrar event_id en todos los logs
7. **Error handling**: Usar DLQ para errores no recuperables

## Troubleshooting

### Mensajes no se consumen
```bash
# Verificar que el consumer está corriendo
ps aux | grep node

# Verificar bindings
rabbitmqadmin list bindings

# Verificar conexiones
rabbitmqadmin list connections
```

### Consumer muy lento
```bash
# Aumentar prefetch count
RABBITMQ_PREFETCH=20 npm start

# Escalar consumers (múltiples instancias)
pm2 start npm --name "triage-consumer-1" -- start
pm2 start npm --name "triage-consumer-2" -- start
```

### Mensajes en DLQ
```bash
# Ver mensajes
rabbitmqadmin get queue=triage_events.dlq count=10

# Analizar patrón de errores
# Los logs mostrarán por qué fallaron
```

## Diagrama de Secuencia - Ejemplo Completo
```
Médico               TurnoService        EventPublisher       RabbitMQ        CoreConsumer        HistorialService
  |                       |                    |                  |                |                    |
  |--finalizar turno----->|                    |                  |                |                    |
  |                       |                    |                  |                |                    |
  |                       |--update DB-------->|                  |                |                    |
  |                       |<-------ok----------|                  |                |                    |
  |                       |                    |                  |                |                    |
  |                       |--publish event---->|                  |                |                    |
  |                       |                    |--publish-------->|                |                    |
  |                       |                    |<------ack--------|                |                    |
  |                       |<------ok-----------|                  |                |                    |
  |                       |                    |                  |                |                    |
  |<-------200 OK---------|                    |                  |                |                    |
  |                       |                    |                  |                |                    |
  |                       |                    |                  |--deliver------>|                    |
  |                       |                    |                  |                |                    |
  |                       |                    |                  |                |--crear historial-->|
  |                       |                    |                  |                |<-------ok----------|
  |                       |                    |                  |                |                    |
  |                       |                    |                  |<------ack------|                    |
```