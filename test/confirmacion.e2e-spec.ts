import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, NotFoundException, BadRequestException } from '@nestjs/common';
import * as request from 'supertest';
import { ConfirmacionController } from '../src/modules/confirmacion/controllers/confirmacion.controller';
import { ConfirmacionService } from '../src/modules/confirmacion/services/confirmacion.service';

describe('Confirmacion (e2e)', () => {
  let app: INestApplication;

  const mockConfirmacionService = {
    confirmarTriage: jest.fn(),
    obtenerConfirmacion: jest.fn(),
    obtenerConfirmacionesPorEnfermero: jest.fn(),
  };

  const dtoValido = {
    registro_triage_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    enfermero_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    nivel_final: 3,
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ConfirmacionController],
      providers: [{ provide: ConfirmacionService, useValue: mockConfirmacionService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    jest.clearAllMocks();
  });

  afterEach(async () => { await app.close(); });

  describe('POST /confirmaciones/confirmar', () => {
    it('201 - confirma el triage exitosamente aceptando sugerencia IA', async () => {
      const expected = {
        confirmacion_id: 'conf-1',
        registro_id: 'reg-1',
        turno_id: 'turno-1',
        nivel_final: 3,
        nombre_nivel: 'Amarillo',
        posicion_cola: 2,
        estado_turno: 'EN_ESPERA',
      };
      mockConfirmacionService.confirmarTriage.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .post('/confirmaciones/confirmar')
        .send(dtoValido);

      expect(res.status).toBe(201);
      expect(res.body.estado_turno).toBe('EN_ESPERA');
      expect(res.body.nivel_final).toBe(3);
    });

    it('201 - confirma con escalamiento (nivel_final < nivel_ia)', async () => {
      const dtoEscalado = { ...dtoValido, nivel_final: 1 };
      mockConfirmacionService.confirmarTriage.mockResolvedValue({
        confirmacion_id: 'conf-2',
        nivel_final: 1,
        posicion_cola: 1,
        estado_turno: 'EN_ESPERA',
      });

      const res = await request(app.getHttpServer())
        .post('/confirmaciones/confirmar')
        .send(dtoEscalado);

      expect(res.status).toBe(201);
      expect(res.body.nivel_final).toBe(1);
    });

    it('404 - retorna 404 si el registro de triage no existe', async () => {
      mockConfirmacionService.confirmarTriage.mockRejectedValue(
        new NotFoundException('Registro de triage no encontrado'),
      );

      const res = await request(app.getHttpServer())
        .post('/confirmaciones/confirmar')
        .send(dtoValido);

      expect(res.status).toBe(404);
    });

    it('400 - rechaza nivel_final fuera de rango [1-5]', async () => {
      const res = await request(app.getHttpServer())
        .post('/confirmaciones/confirmar')
        .send({ ...dtoValido, nivel_final: 0 });

      expect(res.status).toBe(400);
    });

    it('400 - rechaza UUIDs inválidos', async () => {
      const res = await request(app.getHttpServer())
        .post('/confirmaciones/confirmar')
        .send({ ...dtoValido, registro_triage_id: 'no-es-uuid' });

      expect(res.status).toBe(400);
    });

    it('400 - rechaza nivel_final = 6', async () => {
      const res = await request(app.getHttpServer())
        .post('/confirmaciones/confirmar')
        .send({ ...dtoValido, nivel_final: 6 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /confirmaciones/:id', () => {
    it('200 - retorna la confirmación por ID', async () => {
      const conf = { id: 'conf-1', nivel_final_enfermero: 3, acepto_sugerencia: true };
      mockConfirmacionService.obtenerConfirmacion.mockResolvedValue(conf);

      const res = await request(app.getHttpServer())
        .get('/confirmaciones/conf-1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('conf-1');
    });

    it('404 - retorna 404 si la confirmación no existe', async () => {
      mockConfirmacionService.obtenerConfirmacion.mockRejectedValue(
        new NotFoundException('Confirmación no encontrada'),
      );

      const res = await request(app.getHttpServer())
        .get('/confirmaciones/id-inexistente');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /confirmaciones/enfermero/:enfermero_id', () => {
    it('200 - retorna historial de confirmaciones del enfermero', async () => {
      const confs = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
      mockConfirmacionService.obtenerConfirmacionesPorEnfermero.mockResolvedValue(confs);

      const res = await request(app.getHttpServer())
        .get('/confirmaciones/enfermero/b2c3d4e5-f6a7-8901-bcde-f12345678901?limit=50');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });
  });
});