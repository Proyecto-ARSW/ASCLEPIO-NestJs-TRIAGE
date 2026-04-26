# Shared Module

Módulo global que contiene las entidades compartidas entre todos los módulos de triage.

## Entidades

- **NivelTriage**: Niveles de triage según Resolución 5596/2015
- **Enfermero**: Información de enfermeros certificados
- **Formacion**: Niveles de formación de enfermería
- **Hospital**: Instituciones de salud
- **Paciente**: Datos básicos de pacientes
- **Medico**: Datos básicos de médicos
- **Usuario**: Usuario base del sistema
- **Especialidad**: Especialidades médicas

## Uso
```typescript
import { NivelTriage } from '@/modules/shared/entities/nivel-triage.entity';
import { Enfermero } from '@/modules/shared/entities/enfermero.entity';
```
```

---

# **MÓDULO 1: SHARED**

## **Estructura:**
```
src/modules/shared/
├── entities/
│   ├── nivel-triage.entity.ts
│   ├── enfermero.entity.ts
│   ├── formacion.entity.ts
│   ├── hospital.entity.ts
│   ├── paciente.entity.ts
│   ├── medico.entity.ts
│   ├── usuario.entity.ts
│   └── especialidad.entity.ts
├── shared.module.ts
└── README.md