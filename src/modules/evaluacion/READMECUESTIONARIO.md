# Módulo Cuestionario

Gestión del cuestionario de autoevaluación del paciente en el flujo de triage.

## Flujo (Pasos 4-8)

1. **Paciente llena cuestionario** en tablet en sala de espera
2. **Frontend envía respuestas** a POST /api/triage/cuestionario/evaluar
3. **Sistema calcula scores** (total y máximo)
4. **Decide si necesita Ollama:**
   - score_total < 15 Y score_max <= 3 → NO (nivel 4-5 directo)
   - Caso contrario → SÍ (llamar a MS 3)
5. **Guarda cuestionario** con nivel preliminar
6. **Actualiza turno** → ESPERANDO_VITALES
7. **Emite eventos** WebSocket + RabbitMQ
8. **Si nivel 1** → Crea alerta crítica

## Endpoints

### POST /cuestionario/evaluar
Evalúa el cuestionario llenado por el paciente.

**Request:**
```json
{
  "turno_id": "uuid",
  "paciente_id": "uuid",
  "hospital_id": 1,
  "categoria": "DOLOR",
  "respuestas": [
    {
      "pregunta_id": 1,
      "pregunta": "¿Intensidad del dolor?",
      "valor": 4,
      "texto": "Dolor moderado"
    }
  ],
  "motivo_texto_libre": "Me duele el pecho",
  "tiempo_llenado_ms": 45000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cuestionario": { ... },
    "resultado_ia": {
      "nivel_sugerido": 3,
      "sintomas_detectados": ["Dolor torácico", "Dificultad respiratoria"],
      "razon_clinica": "Síntomas de urgencia moderada",
      "confianza": 0.87,
      "requirio_ollama": true
    },
    "mensaje": "Evaluación completada exitosamente",
    "siguiente_paso": "ESPERANDO_VITALES",
    "alerta_critica": false
  }
}
```

### GET /cuestionario/:id
Obtiene un cuestionario por ID.

### GET /cuestionario/turno/:turno_id
Obtiene el cuestionario asociado a un turno.

## Integración con MS 3 (Ollama)

El servicio `OllamaGatewayService` se encarga de:
- Detectar si usar API Gateway o conexión directa
- Construir el request a MS 3
- Manejar timeouts y errores
- Implementar fallback si Ollama no responde

## Variables de entorno
```bash
USE_API_GATEWAY=true
API_GATEWAY_URL=http://api-gateway
OLLAMA_PRELIM_URL=http://localhost:3002  # Solo para desarrollo
```

## Decisión de usar Ollama
```typescript
if (score_total < 15 && score_max <= 3) {
  // NO usar Ollama (caso leve)
  nivel = score_total < 10 ? 5 : 4;
} else {
  // SÍ usar Ollama (caso moderado/grave)
  await ollamaGateway.evaluarPreliminar(...);
}
```