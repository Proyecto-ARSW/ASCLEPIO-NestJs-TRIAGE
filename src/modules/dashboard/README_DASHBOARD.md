# Módulo Dashboard

Dashboards personalizados en tiempo real para cada rol del sistema de triage.

## Dashboards Disponibles

| Dashboard | Rol | Propósito |
|-----------|-----|-----------|
| **Paciente** | PACIENTE | Seguimiento del turno en tiempo real |
| **Recepcionista** | RECEPCIONISTA | Monitoreo general + gestión de turnos |
| **Enfermería** | ENFERMERO | Gestión de cuestionarios y vitales |
| **Médico** | MEDICO | Atención por prioridad + alertas |
| **Jefe Guardia** | JEFE_GUARDIA | Supervisión + métricas operacionales |
| **Administrativo** | ADMIN | KPIs + análisis + reportes |

---

## 1. Dashboard Paciente

### Endpoint
```
GET /api/triage/dashboard/paciente/:turno_id
GET /api/triage/dashboard/paciente/:turno_id/posicion
```

### Descripción
El paciente ve el estado de SU turno en tiempo real desde su celular o tablet.

### Response
```json
{
  "success": true,
  "data": {
    "turno": {
      "numero_turno": 42,
      "estado": "EN_ESPERA",
      "nivel_triage": 3,
      "nivel_nombre": "Urgencia",
      "nivel_color": "#FFEB3B",
      "tiempo_espera_minutos": 25,
      "posicion_en_cola": 4,
      "total_en_cola": 12,
      "consultorio_asignado": null,
      "medico_asignado": null
    },
    "pacientes_delante": {
      "nivel_1": 0,
      "nivel_2": 1,
      "nivel_3": 3
    },
    "tiempo_estimado_espera": 15,
    "historial": [
      {
        "paso": "Turno creado",
        "timestamp": "2026-03-22T10:30:00Z",
        "completado": true
      },
      {
        "paso": "Cuestionario completado",
        "timestamp": "2026-03-22T10:35:00Z",
        "completado": true
      },
      {
        "paso": "En espera de ser llamado",
        "timestamp": "2026-03-22T10:55:00Z",
        "completado": false
      }
    ]
  }
}
```

### Casos de Uso Frontend
```typescript
// React Hook para dashboard paciente
const useDashboardPaciente = (turnoId: string) => {
  const { data, refetch } = useQuery({
    queryKey: ['dashboard-paciente', turnoId],
    queryFn: () => fetchDashboardPaciente(turnoId),
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  // Escuchar WebSocket para actualizaciones en tiempo real
  useEffect(() => {
    socket.on('turno:actualizado', () => {
      refetch();
    });

    socket.on('paciente:llamado', (payload) => {
      if (payload.turno_id === turnoId) {
        // Mostrar notificación push
        showNotification(`TURNO ${payload.numero_turno} - ${payload.consultorio}`);
        refetch();
      }
    });
  }, [turnoId]);

  return data;
};
```

---

## 2. Dashboard Recepcionista

### Endpoints
```
GET  /api/triage/dashboard/recepcionista/:hospital_id
GET  /api/triage/dashboard/recepcionista/:hospital_id/turnos-activos
POST /api/triage/dashboard/recepcionista/buscar-paciente
```

### Descripción
Vista general de urgencias con capacidad de crear turnos y buscar pacientes.

### Response
```json
{
  "success": true,
  "data": {
    "resumen": {
      "turnos_creados": 47,
      "en_espera": 12,
      "atendidos": 35,
      "cancelados": 2,
      "tiempo_promedio_espera": 28
    },
    "alertas_activas": [
      {
        "turno_id": "uuid",
        "numero_turno": 38,
        "tipo": "TRIAGE_CRITICO",
        "mensaje": "Nivel 1 - TRIAGE_CRITICO",
        "timestamp": "2026-03-22T11:00:00Z"
      }
    ],
    "turnos_activos": [
      {
        "numero_turno": 42,
        "paciente_nombre": "Juan Pérez",
        "estado": "EN_ESPERA",
        "nivel_triage": 3,
        "tiempo_espera_minutos": 25,
        "consultorio": null
      }
    ],
    "total_turnos_activos": 12
  }
}
```

### Buscar Paciente
```bash
POST /api/triage/dashboard/recepcionista/buscar-paciente
{
  "criterio": "Juan"
}

# Response
{
  "success": true,
  "data": [
    {
      "paciente_id": "uuid",
      "nombre": "Juan",
      "apellido": "Pérez",
      "documento": "1234567890",
      "tipo_documento": "CC",
      "eps": "Sanitas"
    }
  ]
}
```

---

## 3. Dashboard Enfermero

### Endpoint
```
GET /api/triage/dashboard/enfermero/:hospital_id
```

### Descripción
Muestra turnos pendientes de evaluación organizados por prioridad.

### Response
```json
{
  "success": true,
  "data": {
    "criticos": [
      {
        "id": "uuid",
        "numero_turno": 38,
        "paciente": {
          "nombre": "María",
          "apellido": "López"
        },
        "nivel_triage": 1,
        "estado": "EN_ESPERA",
        "tiempo_espera_minutos": 5
      }
    ],
    "esperando_vitales": [
      {
        "id": "uuid",
        "numero_turno": 43,
        "paciente": {
          "nombre": "Ana",
          "apellido": "García"
        },
        "estado": "ESPERANDO_VITALES",
        "cuestionario": {
          "nivel_sugerido_ia_preliminar": 2,
          "sintomas_detectados_ia": ["Dolor torácico", "Disnea"]
        }
      }
    ],
    "esperando_confirmacion": [
      {
        "id": "uuid",
        "numero_turno": 44,
        "paciente": {
          "nombre": "Luis",
          "apellido": "Torres"
        },
        "estado": "TRIAGE_COMPLETO",
        "registro_triage": {
          "nivel_sugerido_ia": 3,
          "confianza_ia": 0.87
        }
      }
    ],
    "metricas_dia": {
      "total_atendidos": 35,
      "por_nivel_1": 2,
      "por_nivel_2": 8,
      "por_nivel_3": 15,
      "por_nivel_4": 8,
      "por_nivel_5": 2,
      "tiempo_promedio_espera": 28
    }
  }
}
```

---

## 4. Dashboard Médico

### Endpoint
```
GET /api/triage/dashboard/medico/:hospital_id
```

### Descripción
Cola de pacientes organizada por nivel de triage + alertas críticas.

### Response
```json
{
  "success": true,
  "data": {
    "por_niveles": {
      "nivel_1": [
        {
          "id": "uuid",
          "numero_turno": 38,
          "paciente": {
            "nombre": "María",
            "apellido": "López"
          },
          "nivel_triage": 1,
          "tiempo_espera_minutos": 5,
          "registro_triage": {
            "presion_sistolica": 85,
            "saturacion_oxigeno": 88
          }
        }
      ],
      "nivel_2": [...],
      "nivel_3": [...],
      "nivel_4": [...],
      "nivel_5": [...]
    },
    "alertas_pendientes": [
      {
        "id": "uuid",
        "turno_id": "uuid",
        "tipo_alerta": "TRIAGE_CRITICO",
        "nivel_triage": 1,
        "tiempo_sin_confirmar_min": 2
      }
    ],
    "metricas_personales": {
      "atendidos_hoy": 12,
      "tiempo_promedio_atencion": 18,
      "en_consulta_ahora": 1
    }
  }
}
```

### Uso con GraphQL Subscriptions
```typescript
// Combinar REST API con GraphQL Subscriptions
const useDashboardMedico = (hospitalId: number) => {
  // Cargar datos iniciales
  const { data } = useQuery(['dashboard-medico', hospitalId]);

  // Suscribirse a alertas críticas
  useSubscription({
    query: gql`
      subscription TriageCritico($hospital_id: Int!) {
        triageCritico(hospital_id: $hospital_id) {
          id
          turno {
            numero_turno
            paciente {
              nombre
              apellido
            }
          }
          nivel_triage
        }
      }
    `,
    variables: { hospital_id: hospitalId },
    onData: ({ data }) => {
      // Mostrar modal roja bloqueante
      showAlertaCritica(data.triageCritico);
    },
  });

  return data;
};
```

---

## 5. Dashboard Jefe de Guardia

### Endpoint
```
GET /api/triage/dashboard/jefe-guardia/:hospital_id
```

### Descripción
Supervisión completa del servicio de urgencias con métricas en tiempo real.

### Response
```json
{
  "success": true,
  "data": {
    "alertas_escaladas": [
      {
        "id": "uuid",
        "turno_id": "uuid",
        "escalada_en": "2026-03-22T11:05:00Z",
        "razon_escalamiento": "Timeout - Médico no confirmó en 3 min",
        "tiempo_sin_confirmar_min": 5
      }
    ],
    "metricas_tiempo_real": {
      "en_espera": 12,
      "atendiendo": 5,
      "atendidos": 35,
      "cancelados": 2
    },
    "distribucion_niveles": {
      "nivel_1": 2,
      "nivel_1_porcentaje": 4,
      "nivel_2": 8,
      "nivel_2_porcentaje": 17,
      "nivel_3": 18,
      "nivel_3_porcentaje": 38,
      "nivel_4": 14,
      "nivel_4_porcentaje": 30,
      "nivel_5": 5,
      "nivel_5_porcentaje": 11
    },
    "tiempos_promedio": {
      "cuestionario_a_vitales": 8,
      "vitales_a_confirmacion": 5,
      "confirmacion_a_llamado": 22,
      "total_espera": 35,
      "tiempo_atencion": 18
    },
    "enfermeros": [
      {
        "id": "uuid",
        "nombre": "Enfermera López",
        "rol": "ENFERMERO",
        "estado": "OCUPADO",
        "turno_actual": "Turno #43"
      }
    ],
    "medicos": [
      {
        "id": "uuid",
        "nombre": "Dr. Martínez",
        "rol": "MEDICO",
        "estado": "OCUPADO",
        "turno_actual": "Turno #40",
        "consultorio": "1"
      }
    ],
    "metricas_ia": {
      "precision_global": 87,
      "precision_nivel_1": 95,
      "precision_nivel_2": 88,
      "precision_nivel_3": 85,
      "precision_nivel_4": 82,
      "precision_nivel_5": 90,
      "escalamientos": 5,
      "degradaciones": 3
    }
  }
}
```

---

## 6. Dashboard Administrativo

### Endpoint
```
GET /api/triage/dashboard/admin/:hospital_id
```

### Descripción
Vista ejecutiva con KPIs, tendencias, análisis de IA y productividad del personal.

### Response (Simplificado)
```json
{
  "success": true,
  "data": {
    "kpis": {
      "atendidos": 152,
      "cambio_porcentaje": 8,
      "en_sistema": 18,
      "cambio_sistema_porcentaje": -12,
      "tiempo_promedio": 32,
      "cambio_tiempo_minutos": -5,
      "satisfaccion": 4.2,
      "cambio_satisfaccion": 0.3
    },
    "tendencia_atendidos": [
      { "fecha": "2026-03-15", "valor": 120 },
      { "fecha": "2026-03-16", "valor": 135 },
      { "fecha": "2026-03-17", "valor": 142 },
      { "fecha": "2026-03-18", "valor": 155 },
      { "fecha": "2026-03-19", "valor": 148 },
      { "fecha": "2026-03-20", "valor": 165 },
      { "fecha": "2026-03-21", "valor": 152 }
    ],
    "distribucion_semanal": {
      "nivel_1": 15,
      "nivel_1_porcentaje": 2,
      "nivel_2": 98,
      "nivel_2_porcentaje": 13,
      "nivel_3": 312,
      "nivel_3_porcentaje": 42,
      "nivel_4": 245,
      "nivel_4_porcentaje": 33,
      "nivel_5": 74,
      "nivel_5_porcentaje": 10
    },
    "rendimiento_ia": {
      "precision_ollama": 82,
      "precision_random_forest": 87,
      "matriz_confusion": {
        "matriz": [
          [14, 1, 0, 0, 0],
          [3, 82, 8, 2, 0],
          [1, 12, 265, 28, 6],
          [0, 1, 18, 212, 14],
          [0, 0, 2, 8, 64]
        ],
        "etiquetas": ["Nivel 1", "Nivel 2", "Nivel 3", "Nivel 4", "Nivel 5"]
      },
      "factores_ajuste": [
        {
          "factor": "Dolor torácico",
          "frecuencia": 15,
          "tipo": "ESCALAMIENTO"
        },
        {
          "factor": "Vitales estables",
          "frecuencia": 12,
          "tipo": "DEGRADACIÓN"
        }
      ]
    },
    "analisis_tiempos": {
      "tiempos_por_nivel": [
        {
          "nivel": 1,
          "espera": 2,
          "atencion": 25,
          "total": 27,
          "objetivo": 30,
          "cumple_objetivo": true
        }
      ],
      "cuellos_botella": [
        {
          "etapa": "Vitales → Confirmación",
          "tiempo_actual": 12,
          "tiempo_objetivo": 5,
          "recomendacion": "Añadir 1 enfermero en turno tarde"
        }
      ]
    },
    "analisis_personal": {
      "productividad_medicos": [
        {
          "medico_id": "uuid",
          "nombre": "Dr. Martínez",
          "pacientes_por_hora": 4.2,
          "total_atendidos": 42
        }
      ],
      "precision_enfermeros": [
        {
          "enfermero_id": "uuid",
          "nombre": "Enfermera López",
          "precision": 92,
          "evaluaciones_realizadas": 38
        }
      ]
    }
  }
}
```

---

## Actualización en Tiempo Real

Todos los dashboards se actualizan automáticamente vía WebSocket:
```typescript
// Frontend - Ejemplo de actualización automática
useEffect(() => {
  // Conectar WebSocket
  socket.emit('join:hospital', { hospital_id: 1, rol: 'ENFERMERO' });

  // Escuchar eventos
  socket.on('cuestionario:completado', () => {
    refetchDashboard(); // Actualizar vista
  });

  socket.on('vitales:registrados', () => {
    refetchDashboard();
  });

  socket.on('cola:actualizada', () => {
    refetchDashboard();
  });

  return () => {
    socket.off('cuestionario:completado');
    socket.off('vitales:registrados');
    socket.off('cola:actualizada');
  };
}, []);
```

---

## Estrategia de Caché

Los dashboards deben cachear datos para mejorar rendimiento:
```typescript
// React Query - Configuración recomendada
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dashboard Paciente: Caché corto, auto-refetch
      staleTime: 30000, // 30 segundos
      refetchInterval: 30000,

      // Dashboard Admin: Caché más largo
      staleTime: 300000, // 5 minutos
    },
  },
});

// Por dashboard
const useDashboardEnfermero = (hospitalId: number) => {
  return useQuery({
    queryKey: ['dashboard-enfermero', hospitalId],
    queryFn: () => fetchDashboard(hospitalId),
    staleTime: 60000, // 1 minuto
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};
```

---

## Testing

### Test de Dashboard Paciente
```typescript
describe('DashboardPacienteService', () => {
  it('debe retornar el dashboard del paciente', async () => {
    const dashboard = await service.obtenerDashboard('turno-123');

    expect(dashboard).toHaveProperty('turno');
    expect(dashboard).toHaveProperty('pacientes_delante');
    expect(dashboard).toHaveProperty('tiempo_estimado_espera');
    expect(dashboard).toHaveProperty('historial');
  });

  it('debe calcular tiempo estimado correctamente', async () => {
    const dashboard = await service.obtenerDashboard('turno-123');

    expect(dashboard.tiempo_estimado_espera).toBeGreaterThanOrEqual(0);
  });
});
```

### Test de Dashboard Admin
```typescript
describe('DashboardAdminService', () => {
  it('debe calcular KPIs correctamente', async () => {
    const dashboard = await service.obtenerDashboard(1);

    expect(dashboard.kpis.atendidos).toBeGreaterThanOrEqual(0);
    expect(dashboard.kpis.tiempo_promedio).toBeGreaterThanOrEqual(0);
  });

  it('debe generar tendencia de 7 días', async () => {
    const dashboard = await service.obtenerDashboard(1);

    expect(dashboard.tendencia_atendidos).toHaveLength(7);
  });

  it('debe calcular matriz de confusión', async () => {
    const dashboard = await service.obtenerDashboard(1);

    expect(dashboard.rendimiento_ia.matriz_confusion.matriz).toHaveLength(5);
    expect(dashboard.rendimiento_ia.matriz_confusion.matriz[0]).toHaveLength(5);
  });
});
```

---

## Permisos por Dashboard

| Dashboard | Roles Permitidos |
|-----------|------------------|
| Paciente | Todos (sin auth si tiene turno_id) |
| Recepcionista | RECEPCIONISTA, ADMIN |
| Enfermero | ENFERMERO, ADMIN |
| Médico | MEDICO, JEFE_GUARDIA, ADMIN |
| Jefe Guardia | JEFE_GUARDIA, ADMIN |
| Admin | ADMIN |

---

## Performance

### Optimizaciones Implementadas

1. **Índices en PostgreSQL:**
```sql
CREATE INDEX idx_turnos_hospital_fecha_estado 
ON turnos(hospital_id, fecha, estado);

CREATE INDEX idx_turnos_nivel_triage 
ON turnos(nivel_triage_id, estado, fecha);

CREATE INDEX idx_confirmaciones_enfermero_fecha 
ON confirmaciones_enfermero(enfermero_id, creado_en);
```

2. **Caché de Queries Complejas:**
- Métricas de IA: 5 minutos
- Distribución por nivel: 2 minutos
- KPIs principales: 1 minuto

3. **Paginación para Listas Grandes:**
```typescript
// Si hay >100 turnos activos, paginar
const turnos = await prisma.turnos.findMany({
  take: 50,
  skip: page * 50,
  // ...
});
```

---

## Variables de Entorno

No requiere variables adicionales. Usa la configuración existente de PostgreSQL y Redis.

---

## Roadmap

- [ ] Exportar reportes a PDF/Excel
- [ ] Notificaciones push para dashboard paciente
- [ ] Dashboard en pantallas públicas (TV)
- [ ] Modo oscuro para todos los dashboards
- [ ] Personalización de widgets por usuario
- [ ] Comparativas entre hospitales (multi-tenant)