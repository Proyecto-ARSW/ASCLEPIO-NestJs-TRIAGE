# Módulo WebSockets

Sistema de comunicación en tiempo real para dashboards y pantallas de llamados usando Socket.IO.

## Arquitectura
```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE EVENTOS WEBSOCKET                    │
└─────────────────────────────────────────────────────────────────┘

1. Service actualiza PostgreSQL
   ↓
2. Service publica en Redis Pub/Sub
   ↓
3. TriageGateway escucha Redis Pub/Sub
   ↓
4. TriageGateway emite evento Socket.IO
   ↓
5. Frontend conectado recibe evento en tiempo real
```

## Rooms (Salas)

El gateway organiza clientes en rooms para emitir eventos específicos:

| Room | Descripción | Quién se conecta |
|------|-------------|------------------|
| `hospital:{id}` | Eventos generales del hospital | Todos |
| `dashboard:enfermero:{id}` | Dashboard enfermería | Enfermeros |
| `dashboard:medico:{id}` | Dashboard médicos | Médicos, Jefe Guardia |
| `pantalla:llamados:{id}` | Pantalla pública de llamados | TV/Pantallas |

## Eventos del Cliente → Servidor

### join:hospital
Cliente se une a un hospital específico.
```typescript
socket.emit('join:hospital', {
  hospital_id: 1,
  rol: 'ENFERMERO'
});

// Respuesta
socket.on('joined:hospital', (data) => {
  console.log(data.hospital_id, data.timestamp);
});
```

### join:dashboard-enfermero
Enfermero se conecta a su dashboard.
```typescript
socket.emit('join:dashboard-enfermero', {
  hospital_id: 1
});

// Respuesta
socket.on('joined:dashboard-enfermero', (data) => {
  console.log('Conectado al dashboard de enfermería');
});
```

### join:dashboard-medico
Médico se conecta a su dashboard.
```typescript
socket.emit('join:dashboard-medico', {
  hospital_id: 1
});

// Respuesta
socket.on('joined:dashboard-medico', (data) => {
  console.log('Conectado al dashboard médico');
});
```

### join:pantalla-llamados
Pantalla pública se conecta para mostrar llamados.
```typescript
socket.emit('join:pantalla-llamados', {
  hospital_id: 1
});

// Respuesta
socket.on('joined:pantalla-llamados', (data) => {
  console.log('Conectado a pantalla de llamados');
});
```

### ping
Heartbeat para verificar conexión.
```typescript
socket.emit('ping');

socket.on('pong', (data) => {
  console.log('Server alive:', data.timestamp);
});
```

## Eventos del Servidor → Cliente

### turno:creado
Se creó un nuevo turno.
```typescript
socket.on('turno:creado', (payload) => {
  console.log('Nuevo turno:', payload.numero_turno);
  // payload: TurnoEventPayload
});
```

### cuestionario:completado
Paciente completó el cuestionario.
```typescript
socket.on('cuestionario:completado', (payload) => {
  console.log('Cuestionario completado:', payload.turno_id);
  console.log('Nivel preliminar:', payload.nivel_preliminar);
  // payload: CuestionarioEventPayload
});
```

### vitales:registrados
Enfermero registró signos vitales.
```typescript
socket.on('vitales:registrados', (payload) => {
  console.log('Vitales registrados:', payload.turno_id);
  console.log('Nivel sugerido:', payload.nivel_sugerido);
  console.log('Alertas vitales:', payload.alertas_vitales);
  // payload: VitalesEventPayload
});
```

### triage:confirmado
Enfermero confirmó el nivel de triage.
```typescript
socket.on('triage:confirmado', (payload) => {
  console.log('Triage confirmado:', payload.turno_id);
  console.log('Nivel final:', payload.nivel_final);
  console.log('Posición en cola:', payload.posicion_cola);
  // payload: TriageConfirmadoEventPayload
});
```

### cola:actualizada
La cola de espera cambió.
```typescript
socket.on('cola:actualizada', (payload) => {
  console.log('Cola actualizada - Total en espera:', payload.total_en_espera);
  // Refrescar vista de la cola
  // payload: ColaEventPayload
});
```

### paciente:llamado
Médico llamó a un paciente.
```typescript
socket.on('paciente:llamado', (payload) => {
  console.log(`Turno ${payload.numero_turno} → Consultorio ${payload.consultorio}`);
  // payload: PacienteLlamadoEventPayload
});
```

### pantalla:llamar-paciente
Evento específico para pantallas públicas.
```typescript
socket.on('pantalla:llamar-paciente', (payload) => {
  // Mostrar en pantalla grande:
  // "TURNO 42 - JUAN PÉREZ - CONSULTORIO 3"
  mostrarLlamado(payload);
  // payload: PacienteLlamadoEventPayload
});
```

### alerta:critica
Alerta de paciente crítico (nivel 1-2).
```typescript
socket.on('alerta:critica', (payload) => {
  // Mostrar modal roja bloqueante
  mostrarAlertaCritica(payload);
  console.log('ALERTA CRÍTICA - Nivel:', payload.nivel_triage);
  // payload: AlertaCriticaEventPayload
});
```

### notificacion
Notificación general del sistema.
```typescript
socket.on('notificacion', (payload) => {
  // Mostrar toast/snackbar
  mostrarNotificacion(payload.tipo, payload.titulo, payload.mensaje);
  // payload: NotificacionEventPayload
});
```

## Autenticación

El gateway requiere autenticación JWT. El token se puede enviar de 3 formas:

### 1. Authorization Header (Recomendado)
```typescript
const socket = io('http://localhost:3001/triage', {
  extraHeaders: {
    Authorization: `Bearer ${token}`
  }
});
```

### 2. Query Parameter
```typescript
const socket = io('http://localhost:3001/triage', {
  query: {
    token: token
  }
});
```

### 3. Auth Object
```typescript
const socket = io('http://localhost:3001/triage', {
  auth: {
    token: token
  }
});
```

## Ejemplo Completo - Frontend React
```typescript
// useTriageSocket.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useTriageSocket = (hospitalId: number, token: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Conectar
    const newSocket = io('http://localhost:3001/triage', {
      extraHeaders: {
        Authorization: `Bearer ${token}`
      },
      transports: ['websocket', 'polling'],
    });

    // Event handlers
    newSocket.on('connect', () => {
      console.log('✅ WebSocket conectado');
      setConnected(true);
      
      // Unirse al hospital
      newSocket.emit('join:hospital', {
        hospital_id: hospitalId,
        rol: 'ENFERMERO'
      });
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
      setConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('Error WebSocket:', error);
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.close();
    };
  }, [hospitalId, token]);

  return { socket, connected };
};

// DashboardEnfermero.tsx
import { useTriageSocket } from './useTriageSocket';

export const DashboardEnfermero = () => {
  const { socket, connected } = useTriageSocket(1, getToken());
  const [turnos, setTurnos] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Unirse al dashboard
    socket.emit('join:dashboard-enfermero', { hospital_id: 1 });

    // Escuchar eventos
    socket.on('cuestionario:completado', (payload) => {
      console.log('Nuevo cuestionario completado:', payload);
      // Actualizar lista de turnos esperando vitales
      refetchTurnos();
    });

    socket.on('vitales:registrados', (payload) => {
      console.log('Vitales registrados:', payload);
      // Actualizar lista de turnos esperando confirmación
      refetchTurnos();
    });

    socket.on('cola:actualizada', (payload) => {
      console.log('Cola actualizada:', payload);
      // Refrescar cola
      refetchCola();
    });

    return () => {
      socket.off('cuestionario:completado');
      socket.off('vitales:registrados');
      socket.off('cola:actualizada');
    };
  }, [socket]);

  return (
    <div>
      <h1>Dashboard Enfermería</h1>
      <div>Estado: {connected ? '🟢 Conectado' : '🔴 Desconectado'}</div>
      {/* ... resto del dashboard */}
    </div>
  );
};
```

## Ejemplo Completo - Pantalla de Llamados
```typescript
// PantallaLlamados.tsx
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export const PantallaLlamados = () => {
  const [ultimoLlamado, setUltimoLlamado] = useState(null);
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    const socket = io('http://localhost:3001/triage', {
      // Pantallas públicas pueden no requerir auth
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('📺 Pantalla conectada');
      socket.emit('join:pantalla-llamados', { hospital_id: 1 });
    });

    socket.on('pantalla:llamar-paciente', (payload) => {
      // Mostrar llamado grande
      setUltimoLlamado(payload);
      
      // Agregar a historial
      setHistorial(prev => [payload, ...prev].slice(0, 5));
      
      // Reproducir sonido
      playSound();
      
      // Auto-ocultar después de 30 segundos
      setTimeout(() => {
        setUltimoLlamado(null);
      }, 30000);
    });

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div className="pantalla-llamados">
      {ultimoLlamado && (
        <div className="llamado-actual">
          <h1>TURNO {ultimoLlamado.numero_turno}</h1>
          <h2>{ultimoLlamado.paciente_nombre} {ultimoLlamado.paciente_apellido}</h2>
          <h3>CONSULTORIO {ultimoLlamado.consultorio}</h3>
        </div>
      )}
      
      <div className="historial">
        <h4>Últimos llamados:</h4>
        {historial.map((llamado, i) => (
          <div key={i}>
            Turno {llamado.numero_turno} → Consultorio {llamado.consultorio}
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Integración con Services

Los services deben llamar a los métodos `emit*` del gateway:

### Desde CuestionarioService
```typescript
// cuestionario-triage.service.ts
constructor(
  // ...
  @Inject(TriageGateway)
  private readonly triageGateway: TriageGateway,
) {}

async evaluarCuestionario(dto: EvaluarCuestionarioDto) {
  // ... lógica del servicio
  
  // Emitir evento WebSocket
  this.triageGateway.emitCuestionarioCompletado(
    {
      turno_id: dto.turno_id,
      cuestionario_id: cuestionario.id,
      nivel_preliminar: resultadoIA.nivel_sugerido,
      requirio_ollama: requirioOllama,
      timestamp: new Date().toISOString(),
    },
    dto.hospital_id,
  );
}
```

### Desde ConfirmacionService
```typescript
// confirmacion.service.ts
async confirmarTriage(dto: ConfirmarTriageDto) {
  // ... lógica del servicio
  
  // Emitir evento WebSocket
  this.triageGateway.emitTriageConfirmado(
    {
      turno_id: dto.turno_id,
      confirmacion_id: confirmacion.id,
      nivel_final: dto.nivel_final_enfermero,
      acepto_sugerencia: dto.acepto_sugerencia,
      posicion_cola: posicionCola,
      timestamp: new Date().toISOString(),
    },
    registroTriage.hospital_id,
  );
}
```

### Desde TurnoService
```typescript
// turno.service.ts
async llamarPaciente(id: string, dto: LlamarPacienteDto) {
  // ... lógica del servicio
  
  // Emitir evento WebSocket
  this.triageGateway.emitPacienteLlamado(
    {
      turno_id: turno.id,
      numero_turno: turno.numero_turno,
      paciente_nombre: turno.pacientes.usuarios.nombre,
      paciente_apellido: turno.pacientes.usuarios.apellido,
      consultorio: dto.consultorio,
      medico_nombre: medico.usuarios.nombre,
      nivel_triage: turno.nivel_triage_id,
      timestamp: new Date().toISOString(),
    },
    turno.hospital_id,
  );
}
```

## Redis Pub/Sub Integration

El gateway se suscribe automáticamente a eventos de Redis:
```typescript
// Redis publica
await redis.publish('hospital:1:cola:actualizada', JSON.stringify({
  hospital_id: 1,
  total_en_espera: 15,
  timestamp: new Date().toISOString()
}));

// Gateway escucha y emite WebSocket
// Los clientes conectados al hospital 1 reciben el evento automáticamente
```

## Debugging

### Ver clientes conectados
```bash
# Desde el servidor
this.logger.log(`Clientes conectados: ${this.server.sockets.sockets.size}`);
```

### Ver rooms
```bash
# Desde el servidor
console.log(this.server.sockets.adapter.rooms);
```

### Logs útiles
El gateway registra:
- ✅ Conexiones/desconexiones
- 👥 Uniones a rooms
- 📤 Eventos emitidos
- ❌ Errores de autenticación

## Testing con Socket.IO Client
```bash
npm install -g wscat
wscat -c "ws://localhost:3001/triage?token=YOUR_JWT_TOKEN"
```

O usar Postman (soporta WebSockets desde v8.5).

## Variables de entorno
```bash
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

## Limitaciones y Consideraciones

### Escalabilidad
Para múltiples instancias del servidor, usar **Redis Adapter**:
```typescript
import { createAdapter } from '@socket.io/redis-adapter';

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

### Rate Limiting
Implementar rate limiting para evitar spam:
```typescript
@UseGuards(WsAuthGuard, WsThrottleGuard)
```

### Reconnection
El cliente debe implementar lógica de reconexión:
```typescript
const socket = io('...', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});
```