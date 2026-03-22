# ASCLEPIO Triage - Microservicio de Gestión de Urgencias

Microservicio para gestión de triage hospitalario inteligente del sistema ASCLEPIO.

## 🏥 Descripción

Sistema de triage hospitalario que permite:
- Autoevaluación del paciente mediante cuestionario
- Evaluación preliminar con IA (Ollama/Mistral)
- Registro de signos vitales por enfermero
- Clasificación final con Random Forest
- Confirmación y ajuste por enfermero certificado
- Cola priorizada en tiempo real
- Alertas críticas automáticas
- Dashboard en tiempo real para médicos y enfermeros

## 🚀 Tecnologías

- **Framework:** NestJS 11
- **Lenguaje:** TypeScript 5.7
- **Base de datos:** PostgreSQL 15 + Prisma ORM
- **Cache/Cola:** Redis 7
- **Eventos:** RabbitMQ 3
- **WebSockets:** Socket.IO
- **GraphQL:** Apollo Server (Subscriptions)
- **Monitoreo:** Prometheus + Grafana

## 📋 Requisitos previos

- Node.js 20+
- pnpm 8+
- Docker y Docker Compose
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3+

## 🔧 Instalación

### 1. Clonar repositorio
```bash
git clone https://github.com/tu-equipo/asclepio-triage.git
cd asclepio-triage
```

### 2. Instalar dependencias
```bash
pnpm install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tus valores
```

### 4. Inicializar base de datos
```bash
# Generar Prisma Client
pnpm prisma generate

# Ejecutar migraciones
pnpm prisma migrate dev

# (Opcional) Seed de datos iniciales
pnpm prisma:seed
```

## 🏃 Ejecución

### Desarrollo
```bash
pnpm start:dev
```

### Producción (Docker)
```bash
docker-compose up -d
```

### Ver logs
```bash
docker-compose logs -f triage-service
```

## 📊 Monitoreo

- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:4001 (admin/admin)
- **RabbitMQ Management:** http://localhost:15672 (guest/guest)

## 🧪 Testing
```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov
```

## 📚 Documentación API

Una vez iniciado el servidor:
- **GraphQL Playground:** http://localhost:3001/graphql
- **Swagger/OpenAPI:** http://localhost:3001/api

## 🏗️ Arquitectura
```
src/
├── modules/
│   ├── cuestionario/        # Cuestionarios de pacientes
│   ├── registro-triage/     # Registro de vitales y evaluación
│   ├── confirmacion/        # Confirmación de enfermeros
│   ├── turnos/              # Gestión de turnos de urgencias
│   ├── cola/                # Cola priorizada en Redis
│   ├── alertas/             # Alertas críticas
│   ├── websockets/          # Gateway WebSocket
│   └── graphql/             # Resolvers GraphQL
├── common/                  # Utilidades compartidas
├── config/                  # Configuración
└── main.ts                  # Entry point
```

## 🔗 Integración con otros microservicios

- **asclepio-core (3000):** Datos de usuarios, pacientes, médicos
- **ptia-ollama-prelim (3002):** IA evaluación preliminar
- **ptia-triage-classifier (3003):** IA clasificación final
- **asclepio-farmacia (3004):** Medicamentos y órdenes

## 👥 Equipo

- **Proyecto:** ASCLEPIO - ECI
- **Materias:** TDSE + ARSW
- **Año:** 2026-1

## 📄 Licencia

UNLICENSED - Proyecto académico