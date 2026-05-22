# ASCLEPIO Triage — Microservicio de Gestión de Urgencias

Microservicio NestJS encargado del flujo completo de triage hospitalario inteligente dentro del ecosistema **ASCLEPIO**.

---

## Descripción

Este servicio gestiona el ciclo de vida de un paciente desde su llegada a urgencias hasta que es atendido por un médico:

1. **Recepción del ingreso** — recibe datos de síntomas y signos vitales desde ISISvoice o desde el frontend de recepción.
2. **Clasificación IA** — envía los datos a un servicio de Random Forest que asigna un nivel de triage (1–5). Si el clasificador no está disponible, aplica una lógica de fallback basada en el nivel preliminar de ISISvoice.
3. **Detección de alertas vitales** — identifica automáticamente condiciones críticas (taquicardia, hipoxemia, hipotensión, shock index elevado, taquipnea, fiebre alta).
4. **Confirmación del enfermero** — el enfermero revisa el nivel sugerido por la IA, puede aceptarlo, escalarlo o degradarlo, y registra la confirmación.
5. **Cola priorizada en Redis** — el turno se inserta en un sorted set de Redis ordenado por nivel de triage y tiempo de llegada.
6. **Alertas críticas** — los niveles 1 y 2 generan alertas inmediatas y notificaciones WebSocket al dashboard de médicos.
7. **Escalamiento automático** — una alerta puede escalar si no es atendida en el tiempo máximo permitido.
8. **Llamado y atención** — el médico llama al paciente, se registra la consulta de urgencia y se finaliza el turno.
9. **Dashboards en tiempo real** — vistas especializadas para paciente, recepcionista, enfermero, médico, jefe de guardia y administrador.
10. **Sincronización con Core** — sincroniza y cachea localmente usuarios, pacientes, médicos y enfermeros desde el microservicio Core.
11. **Notificaciones a Core** — informa a Core sobre eventos clave (turno creado, cancelado, paciente atendido) via webhooks con reintentos automáticos.

---

## Tecnologías

| Categoría    | Tecnología                        |
|--------------|-----------------------------------|
| Framework    | NestJS 11                         |
| Lenguaje     | TypeScript 5.7                    |
| Base de datos| PostgreSQL 15 + Prisma ORM 5.22   |
| Cache / Cola | Redis 7 + ioredis                 |
| Mensajería   | RabbitMQ 3 + amqplib              |
| WebSockets   | Socket.IO 4                       |
| GraphQL      | Apollo Server 5                   |
| HTTP Client  | @nestjs/axios                     |
| Monitoreo    | Prometheus + Grafana              |
| Testing      | Jest 30 + ts-jest                 |

## Estructura del proyecto

```text
src/
├── common/
│   ├── decorators/        # @CurrentUser, @Roles
│   ├── filters/           # HttpExceptionFilter global
│   ├── guards/            # AuthGuard (JWT), RolesGuard, IsisVoiceApiKeyGuard
│   ├── interceptors/      # LoggingInterceptor, TransformInterceptor
│   └── pipes/             # ValidationPipe global
│
├── config/                # Configuraciones (DB, Redis, RabbitMQ, WebSocket, GraphQL)
│
├── modules/
│   ├── alertas/           # Alertas críticas y de triage, escalamiento automático
│   ├── cola/              # Cola priorizada en Redis (sorted sets por nivel)
│   ├── confirmacion/      # Confirmación del nivel de triage por enfermero
│   ├── consultas-urgencia/# Historial de consultas de urgencia por paciente
│   ├── core-client/       # Sincronización y webhooks con el microservicio Core
│   ├── dashboard/         # Dashboards por rol (paciente, recepcionista, enfermero,
│   │                      # médico, jefe de guardia, administrador)
│   ├── eventos/           # Publishers y consumers de eventos RabbitMQ
│   ├── prisma/            # PrismaService (conexión a PostgreSQL)
│   ├── recepcion/         # Ingreso de pacientes (triage + ISISvoice)
│   ├── shared/            # Entidades compartidas (Hospital, Paciente, Médico, etc.)
│   ├── tasks/             # Tareas programadas (@nestjs/schedule)
│   ├── turnos/            # CRUD de turnos de urgencia
│   └── websockets/        # TriageGateway (Socket.IO), guards y decorators WS
│
├── graphql/
│   └── scalars/           # Scalar Date para GraphQL
│
├── health/                # Health checks (Terminus + RabbitMQ)
└── main.ts                # Bootstrap, CORS, pipes, filtros globales
```

## Módulos principales

### `recepcion`

Punto de entrada del flujo de triage. Expone dos endpoints:

- `POST /recepcion/ingreso` — ingreso desde el frontend de recepción (uso interno).
- `POST /recepcion/ingreso-isisvoice` — ingreso desde ISISvoice (protegido por API key).

Internamente: sincroniza paciente/enfermero con Core → genera número de turno → llama al clasificador IA → detecta alertas vitales → crea el turno y el registro de triage → notifica por WebSocket y RabbitMQ.

---

### `turnos`

Gestión del ciclo de vida del turno:

- Crear, consultar por ID y por hospital.
- Actualizar estado, llamar paciente a consultorio, finalizar atención.
- Cancelación por paciente (`PUT /:id/cancelar-paciente`) y por administración (`DELETE /:id`).

---

### `confirmacion`

El enfermero confirma o modifica el nivel sugerido por la IA:

- Registra si aceptó, escaló (`ESCALAMIENTO`) o degradó (`DEGRADACION`) el nivel.
- Inserta el turno en la cola Redis.
- Genera alerta crítica automáticamente para niveles 1 y 2.

---

### `cola`

Gestión de la cola de espera mediante Redis sorted sets:

- Agregar/remover turnos, consultar posición, obtener siguiente turno por nivel.
- Estadísticas de ocupación por hospital y nivel.

---

### `alertas`

- **AlertaCriticaService** — crea, confirma, escala y desactiva alertas críticas.
- **AlertaTriageService** — alertas de tiempo de espera excedido.
- **EscalamientoService** — escalamiento manual y automático de alertas.

---

### `dashboard`

Vistas de datos en tiempo real diferenciadas por rol:

| Servicio                        | Rol            | Datos principales                                          |
|---------------------------------|----------------|------------------------------------------------------------|
| `DashboardPacienteService`      | PACIENTE       | Estado del turno, posición en cola, tiempo estimado        |
| `DashboardRecepcionistaService` | RECEPCIONISTA  | Resumen del día, turnos activos, búsqueda de paciente      |
| `DashboardEnfermeroService`     | ENFERMERO      | Turnos críticos, pendientes de confirmación, métricas del día |
| `DashboardMedicoService`        | MEDICO         | Turnos por nivel, alertas pendientes, métricas personales  |
| `DashboardJefeGuardiaService`   | JEFE_GUARDIA   | Métricas tiempo real, distribución de niveles, estado de personal |
| `DashboardAdminService`         | ADMIN          | KPIs, tendencia 7 días, rendimiento IA, análisis de tiempos |

---

### `core-client`

- **CoreClientService** — sincroniza hospitales, especialidades, usuarios, pacientes, médicos y enfermeros desde el microservicio Core. Implementa patrón cache-aside (consulta local primero).
- **CoreNotifierService** — envía webhooks a Core con reintentos exponenciales (hasta 3 intentos: 2s, 4s, 6s).

---

### `websockets`

**TriageGateway** (Socket.IO) — emite eventos en tiempo real:

- `turno:creado`, `triage:confirmado`, `paciente:llamado`
- `alerta:critica`, `alerta:escalada`
- Emite por sala de hospital, por sala de paciente individual y al dashboard de enfermeros.

---

### `eventos`

**TriageEventPublisher** — publica eventos a RabbitMQ: turno creado/cancelado, triage confirmado, paciente llamado/atendido, alerta crítica.

---

### `consultas-urgencia`

- `GET /consultas-urgencia/paciente/:id` — historial paginado de consultas de urgencia con nombre del médico resuelto.

---

### `tasks`

Tareas programadas con `@nestjs/schedule` para mantenimiento y escalamiento automático de alertas no atendidas.

---

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Aplicación
PORT=3001
NODE_ENV=development

# Base de datos
DATABASE_URL=postgresql://usuario:password@localhost:5432/asclepio_triage

# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Microservicio Core
CORE_API_URL=http://localhost:3000
CORE_API_KEY=tu_api_key_compartida

# Clasificador IA (Random Forest)
CLASSIFIER_URL=http://localhost:8000

# JWT (clave pública del Core para verificar tokens)
JWT_SECRET=tu_secreto_jwt

# ISISvoice API Key
ISISVOICE_API_KEY=tu_api_key_isisvoice

# WebSocket
WS_CORS_ORIGIN=http://localhost:4200
```

---

## Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/Proyecto-ARSW/ASCLEPIO-NestJs-TRIAGE.git
cd ASCLEPIO-NestJs-TRIAGE
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con los valores del entorno
```

### 4. Generar Prisma Client y ejecutar migraciones

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. Iniciar en desarrollo

```bash
npm run start:dev
```

### 6. Iniciar en producción (Docker)

```bash
docker-compose up -d
```

---

## Scripts disponibles

| Script                    | Descripción                                      |
|---------------------------|--------------------------------------------------|
| `npm run start:dev`       | Inicia en modo watch (desarrollo)                |
| `npm run start:prod`      | Inicia desde el build compilado                  |
| `npm run build`           | Compila TypeScript a `dist/`                     |
| `npm run test`            | Ejecuta todos los unit tests                     |
| `npm run test:cov`        | Ejecuta tests con reporte de cobertura           |
| `npm run test:e2e`        | Ejecuta tests end-to-end                         |
| `npm run lint`            | Linting con ESLint + fix automático              |
| `npm run prisma:generate` | Regenera el Prisma Client                        |
| `npm run prisma:migrate`  | Aplica migraciones pendientes                    |
| `npm run prisma:studio`   | Abre Prisma Studio (explorador visual de BD)     |

---

## Testing

El proyecto cuenta con cobertura de pruebas unitarias para todos los módulos principales usando Jest y `@nestjs/testing`.

### Ejecutar tests

```bash
# Todos los tests
npm run test

# Con cobertura
npm run test:cov

# Un archivo específico
npx jest src/modules/turnos/services/turno.service.spec.ts
```

### Archivos de spec disponibles

| Módulo             | Archivos spec                                                                                         |
|--------------------|-------------------------------------------------------------------------------------------------------|
| Turnos             | `turno.service.spec.ts`, `turno.controller.spec.ts`, `generador-numero.service.spec.ts`               |
| Confirmación       | `confirmacion.service.spec.ts`, `confirmacion.controller.spec.ts`                                     |
| Recepción          | `recepcion.service.spec.ts`, `recepcion.controller.spec.ts`, `classifier-gateway.service.spec.ts`     |
| Alertas            | `alerta-critica.service.spec.ts`, `alerta-triage.service.spec.ts`, `escalamiento.service.spec.ts`, `alerta.controller.spec.ts` |
| Cola               | `cola.service.spec.ts`                                                                                |
| Dashboard          | `dashboard-paciente.service.spec.ts`, `dashboard-enfermero.service.spec.ts`, `dashboard-medico.service.spec.ts`, `dashboard-admin.service.spec.ts` |
| Core Client        | `core-client.service.spec.ts`, `core-notifier.service.spec.ts`                                        |
| Consultas Urgencia | `consultas-urgencia.service.spec.ts`, `consultas-urgencias.controller.spec.ts`                        |
| Guards             | `auth.guard.spec.ts`, `roles.guard.spec.ts`                                                           |

---

## Documentación de la API

Con el servidor en ejecución:

- **Swagger / OpenAPI:** http://localhost:3001/api
- **GraphQL Playground:** http://localhost:3001/graphql

### Endpoints principales

#### Recepción

| Método | Ruta                             | Descripción                                        |
|--------|----------------------------------|----------------------------------------------------|
| POST   | `/recepcion/ingreso`             | Registrar ingreso a triage                         |
| POST   | `/recepcion/ingreso-isisvoice`   | Registrar ingreso desde ISISvoice (API key requerida) |

#### Turnos

| Método | Ruta                               | Descripción                          |
|--------|------------------------------------|--------------------------------------|
| POST   | `/turnos`                          | Crear turno de urgencia              |
| GET    | `/turnos/:id`                      | Obtener turno por ID                 |
| GET    | `/turnos/hospital/:hospital_id`    | Listar turnos por hospital           |
| PUT    | `/turnos/:id/estado`               | Actualizar estado del turno          |
| PUT    | `/turnos/:id/llamar`               | Llamar paciente a consultorio        |
| PUT    | `/turnos/:id/finalizar`            | Finalizar turno de atención          |
| PUT    | `/turnos/:id/cancelar-paciente`    | Cancelar turno (por paciente)        |
| DELETE | `/turnos/:id`                      | Cancelar turno (por administración)  |

#### Confirmación

| Método | Ruta                              | Descripción                        |
|--------|-----------------------------------|------------------------------------|
| POST   | `/confirmaciones/confirmar`       | Confirmar nivel de triage          |
| GET    | `/confirmaciones/:id`             | Obtener confirmación por ID        |
| GET    | `/confirmaciones/enfermero/:id`   | Confirmaciones por enfermero       |

#### Alertas

| Método | Ruta                                    | Descripción                          |
|--------|-----------------------------------------|--------------------------------------|
| POST   | `/alertas/critica`                      | Crear alerta crítica                 |
| PUT    | `/alertas/:id/confirmar`                | Confirmar alerta                     |
| PUT    | `/alertas/:id/escalar`                  | Escalar alerta manualmente           |
| POST   | `/alertas/escalamiento/procesar`        | Procesar escalamientos automáticos   |
| GET    | `/alertas/hospital/:id`                 | Alertas activas por hospital         |
| GET    | `/alertas/:id`                          | Obtener alerta por ID                |

#### Dashboard

| Método | Ruta                                  | Rol requerido  |
|--------|---------------------------------------|----------------|
| GET    | `/dashboard/paciente/:turno_id`       | PACIENTE       |
| GET    | `/dashboard/recepcionista/:hospital_id` | RECEPCIONISTA |
| GET    | `/dashboard/enfermero/:hospital_id`   | ENFERMERO      |
| GET    | `/dashboard/medico/:hospital_id`      | MEDICO         |
| GET    | `/dashboard/jefe-guardia/:hospital_id`| JEFE_GUARDIA   |
| GET    | `/dashboard/admin/:hospital_id`       | ADMIN          |

#### Consultas de urgencia

| Método | Ruta                               | Descripción                      |
|--------|------------------------------------|----------------------------------|
| GET    | `/consultas-urgencia/paciente/:id` | Historial paginado por paciente  |

---

## Integración con otros servicios

| Servicio                   | Puerto | Rol                                                        |
|----------------------------|--------|------------------------------------------------------------|
| `asclepio-core`            | 3000   | Fuente de datos de usuarios, pacientes, médicos, hospitales |
| `asclepio-frontend`        | 4200   | Frontend Angular que consume este servicio                 |
| ISISvoice                  | —      | Envía ingresos de pacientes vía API key                    |
| Random Forest Classifier   | 8000   | Clasificación de nivel de triage (1–5)                     |
| PostgreSQL                 | 5432   | Persistencia principal                                     |
| Redis                      | 6379   | Cola priorizada de turnos                                  |
| RabbitMQ                   | 5672   | Bus de eventos entre microservicios                        |

---

## Monitoreo

| Herramienta          | URL                                           |
|----------------------|-----------------------------------------------|
| Prometheus           | http://localhost:9090                         |
| Grafana              | http://localhost:4001 (admin / admin)         |
| RabbitMQ Management  | http://localhost:15672 (guest / guest)        |
| Health Check         | http://localhost:3001/health                  |

---

## Roles del sistema

| Rol           | Descripción                                                  |
|---------------|--------------------------------------------------------------|
| PACIENTE      | Puede consultar su propio turno y posición en cola           |
| RECEPCIONISTA | Registra ingresos y gestiona turnos                          |
| ENFERMERO     | Confirma niveles de triage y ve alertas críticas             |
| MEDICO        | Llama pacientes, realiza consultas y finaliza turnos         |
| JEFE_GUARDIA  | Supervisa métricas operativas en tiempo real                 |
| ADMIN         | Acceso completo a KPIs, reportes y configuración             |

---

## Equipo

- **Proyecto:** ASCLEPIO — Sistema de Gestión Hospitalaria Inteligente
- **Materias:** TDSE + ARSW
- **Institución:** Escuela Colombiana de Ingeniería Julio Garavito (ECI)
- **Año:** 2026-1

---

## Licencia

UNLICENSED — Proyecto académico, todos los derechos reservados.
