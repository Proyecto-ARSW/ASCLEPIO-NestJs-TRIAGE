# Módulo Cola

Gestión de cola priorizada de pacientes en espera usando Redis Sorted Sets.

## Arquitectura

### Estructura de datos en Redis

**Sorted Sets (cola por nivel):**
```
Key: hospital:{id}:cola:triage:{nivel}
Score: nivel * 1000000 + timestamp
Member: turno_id
```

**Hashes (metadata de turnos):**
```
Key: turno:{turno_id}
Fields:
  - turno_id
  - numero_turno
  - paciente_id
  - paciente_nombre
  - paciente_apellido
  - nivel_triage
  - hospital_id
  - ingreso_cola (ISO timestamp)
  - alerta_critica (true/false)
```

## Priorización

La cola se ordena automáticamente por:
1. **Nivel de triage** (1 > 2 > 3 > 4 > 5)
2. **Tiempo de llegada** (FIFO dentro del mismo nivel)

Score = `nivel * 1000000 + timestamp`

Ejemplos:
- Nivel 1 a las 10:00:00 → Score: 1,000,000 + timestamp
- Nivel 2 a las 09:00:00 → Score: 2,000,000 + timestamp (menor prioridad que nivel 1)
- Nivel 1 a las 11:00:00 → Score: 1,000,000 + timestamp (después del nivel 1 de las 10:00)

## Métodos principales

### agregarACola(turnoId, hospitalId, nivelTriage)
Agrega un turno a la cola después de confirmación del enfermero.

### removerDeCola(turnoId, hospitalId, nivelTriage)
Remueve un turno cuando es llamado por el médico.

### obtenerPosicionEnCola(turnoId, hospitalId, nivelTriage)
Calcula la posición actual de un turno en su nivel.

### obtenerColaPorHospital(hospitalId)
Retorna todos los turnos en espera organizados por nivel.

### obtenerSiguienteTurno(hospitalId)
Obtiene el turno con mayor prioridad para atender.

### obtenerEstadisticas(hospitalId)
Retorna estadísticas de la cola (tiempos, distribución por nivel, alertas).

## Integración con otros módulos

El módulo **confirmacion** llama a `agregarACola()` después de confirmar el triage.

El módulo **turnos** llama a `removerDeCola()` cuando el médico llama al paciente.

El módulo **dashboard** consume las estadísticas para mostrar la cola en tiempo real.

## Pub/Sub

Cuando la cola se actualiza, se publica un mensaje:
```
Channel: hospital:{id}:cola:actualizada
Message: { hospital_id, timestamp }
```

El WebSocket Gateway escucha este canal y notifica a los dashboards conectados.

## Ejemplo de uso
```typescript
// Después de confirmar triage
const posicion = await colaService.agregarACola(
  turno.id,
  turno.hospital_id,
  nivel_final
);

// Cuando médico llama paciente
await colaService.removerDeCola(
  turno.id,
  turno.hospital_id,
  turno.nivel_triage_id
);

// Para dashboard
const cola = await colaService.obtenerColaPorHospital(hospital_id);
const stats = await colaService.obtenerEstadisticas(hospital_id);
```

## Timeouts y alertas

El sistema puede detectar tiempos de espera excedidos:
- Nivel 1: 0 min (inmediato)
- Nivel 2: 10 min
- Nivel 3: 60 min
- Nivel 4: 120 min
- Nivel 5: 240 min

Esto se implementará en el módulo **alertas** mediante un cron job que revisa la cola.