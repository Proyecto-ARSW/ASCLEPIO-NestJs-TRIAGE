import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { RecepcionController } from '../src/modules/recepcion/controllers/recepcion.controller';
import { RecepcionService } from '../src/modules/recepcion/services/recepcion.service';

describe('Recepcion (e2e)', () => {
  let app: INestApplication;

  const mockRecepcionService = {
    procesarIngreso: jest.fn(),
  };

  const dtoValido = {
    paciente_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    hospital_id: 1,
    enfermero_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    motivo_consulta: 'Dolor de cabeza intenso',
    sintomas: ['cefalea', 'mareo'],
    embarazo: false,
    antecedentes: ['hipertension'],
    nivel_preliminar_isisvoice: 3,
    presion_sistolica: 120,
    presion_diastolica: 80,
    frecuencia_cardiaca: 75,
    frecuencia_respiratoria: 16,
    temperatura: 37.0,
    saturacion_oxigeno: 98,
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RecepcionController],
      providers: [{ provide: RecepcionService, useValue: mockRecepcionService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    jest.clearAllMocks();
  });

  afterEach(async () => { await app.close(); });

  describe('POST /recepcion/ingreso', () => {
    it('200 - procesa el ingreso exitosamente', async () => {
      const expected = {
        turno_id: 'turno-1',
        numero_turno: 1,
        registro_triage_id: 'reg-1',
        nivel_sugerido_ia: 3,
        confianza_ia: 0.85,
        alertas_vitales: [],
        estado: 'ESPERANDO_CONFIRMACION',
      };
      mockRecepcionService.procesarIngreso.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .post('/recepcion/ingreso')
        .send(dtoValido);

      expect(res.status).toBe(200);
      expect(res.body.turno_id).toBe('turno-1');
      expect(res.body.estado).toBe('ESPERANDO_CONFIRMACION');
      expect(res.body.nivel_sugerido_ia).toBe(3);
    });

    it('200 - procesa con alertas vitales cuando los signos son críticos', async () => {
      const expected = {
        turno_id: 'turno-2',
        numero_turno: 2,
        registro_triage_id: 'reg-2',
        nivel_sugerido_ia: 1,
        confianza_ia: 0.9,
        alertas_vitales: ['Taquicardia (FC > 100 lpm)', 'Hipoxemia (SpO2 < 92%)'],
        estado: 'ESPERANDO_CONFIRMACION',
      };
      mockRecepcionService.procesarIngreso.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .post('/recepcion/ingreso')
        .send({ ...dtoValido, frecuencia_cardiaca: 115, saturacion_oxigeno: 88 });

      expect(res.status).toBe(200);
      expect(res.body.alertas_vitales).toHaveLength(2);
    });

    it('200 - usa clasificación fallback cuando el clasificador no responde', async () => {
      const expected = {
        turno_id: 'turno-3',
        numero_turno: 3,
        registro_triage_id: 'reg-3',
        nivel_sugerido_ia: 3,
        confianza_ia: 0.5,
        alertas_vitales: [],
        estado: 'ESPERANDO_CONFIRMACION',
      };
      mockRecepcionService.procesarIngreso.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .post('/recepcion/ingreso')
        .send(dtoValido);

      expect(res.status).toBe(200);
      expect(res.body.confianza_ia).toBe(0.5);
    });

    it('400 - rechaza DTO sin campos requeridos', async () => {
      const res = await request(app.getHttpServer())
        .post('/recepcion/ingreso')
        .send({ paciente_id: 'pac-1' });

      expect(res.status).toBe(400);
    });

    it('400 - rechaza nivel_preliminar_isisvoice fuera de rango [1-5]', async () => {
      const res = await request(app.getHttpServer())
        .post('/recepcion/ingreso')
        .send({ ...dtoValido, nivel_preliminar_isisvoice: 6 });

      expect(res.status).toBe(400);
    });

    it('400 - rechaza UUIDs inválidos', async () => {
      const res = await request(app.getHttpServer())
        .post('/recepcion/ingreso')
        .send({ ...dtoValido, paciente_id: 'no-es-uuid' });

      expect(res.status).toBe(400);
    });
  });
});