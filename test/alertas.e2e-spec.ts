import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, NotFoundException } from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AlertaController } from '../src/modules/alertas/controllers/alerta.controller';
import { AlertaCriticaService } from '../src/modules/alertas/services/alerta-critica.service';
import { AlertaTriageService } from '../src/modules/alertas/services/alerta-triage.service';
import { EscalamientoService } from '../src/modules/alertas/services/escalamiento.service';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';

const JWT_SECRET = 'test-secret';
const token = (rol: string) => jwt.sign({ id: 'u1', rol }, JWT_SECRET);

describe('Alertas (e2e)', () => {
  let app: INestApplication;

  const mockAlertaCriticaService = {
    crearAlerta: jest.fn(),
    confirmarAlerta: jest.fn(),
    obtenerAlertasActivas: jest.fn(),
    obtenerPorId: jest.fn(),
  };
  const mockAlertaTriageService = { obtenerAlertasActivas: jest.fn() };
  const mockEscalamientoService = {
    escalarAlerta: jest.fn(),
    procesarEscalamientoAutomatico: jest.fn(),
  };

  const mockAlerta = {
    id: 'alerta-e2e-1',
    turno_id: 'turno-1',
    hospital_id: 1,
    nivel_triage: 1,
    tipo_alerta: 'TRIAGE_CRITICO',
    confirmada: false,
    escalada: false,
    activa: true,
    creado_en: new Date().toISOString(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AlertaController],
      providers: [
        { provide: AlertaCriticaService, useValue: mockAlertaCriticaService },
        { provide: AlertaTriageService, useValue: mockAlertaTriageService },
        { provide: EscalamientoService, useValue: mockEscalamientoService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(JWT_SECRET) } },
        Reflector,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    jest.clearAllMocks();
  });

  afterEach(async () => { await app.close(); });

  describe('POST /alertas/critica', () => {
    it('201 - crea alerta crítica con rol ENFERMERO', async () => {
      mockAlertaCriticaService.crearAlerta.mockResolvedValue({
        alerta: mockAlerta,
        mensaje: 'Alerta crítica creada',
        notificado_a: [],
      });

      const res = await request(app.getHttpServer())
        .post('/alertas/critica')
        .set('Authorization', `Bearer ${token('ENFERMERO')}`)
        .send({
          turno_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          hospital_id: 1,
          nivel_triage: 1,
          tipo_alerta: 'TRIAGE_CRITICO',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('401 - rechaza sin token de autenticación', async () => {
      const res = await request(app.getHttpServer())
        .post('/alertas/critica')
        .send({ turno_id: 'turno-1', hospital_id: 1, nivel_triage: 1, tipo_alerta: 'TRIAGE_CRITICO' });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /alertas/:id/confirmar', () => {
    it('200 - médico confirma la alerta', async () => {
      mockAlertaCriticaService.confirmarAlerta.mockResolvedValue({ ...mockAlerta, confirmada: true, activa: false });

      const res = await request(app.getHttpServer())
        .put('/alertas/alerta-e2e-1/confirmar')
        .set('Authorization', `Bearer ${token('MEDICO')}`)
        .send({ medico_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.confirmada).toBe(true);
    });

    it('404 - retorna 404 si la alerta no existe', async () => {
      mockAlertaCriticaService.confirmarAlerta.mockRejectedValue(new NotFoundException('Alerta no encontrada'));

      const res = await request(app.getHttpServer())
        .put('/alertas/id-inexistente/confirmar')
        .set('Authorization', `Bearer ${token('MEDICO')}`)
        .send({ medico_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /alertas/:id/escalar', () => {
    it('200 - jefe de guardia escala la alerta', async () => {
      mockEscalamientoService.escalarAlerta.mockResolvedValue({ ...mockAlerta, escalada: true });

      const res = await request(app.getHttpServer())
        .put('/alertas/alerta-e2e-1/escalar')
        .set('Authorization', `Bearer ${token('JEFE_GUARDIA')}`)
        .send({
          jefe_guardia_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          razon_escalamiento: 'No hay médico disponible',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.escalada).toBe(true);
    });
  });

  describe('GET /alertas/hospital/:hospital_id', () => {
    it('200 - retorna alertas críticas y de tiempo de espera activas', async () => {
      mockAlertaCriticaService.obtenerAlertasActivas.mockResolvedValue([mockAlerta, { ...mockAlerta, id: 'a2' }]);
      mockAlertaTriageService.obtenerAlertasActivas.mockResolvedValue([{ id: 'b1' }]);

      const res = await request(app.getHttpServer())
        .get('/alertas/hospital/1')
        .set('Authorization', `Bearer ${token('MEDICO')}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total_criticas).toBe(2);
      expect(res.body.data.total_tiempo_espera).toBe(1);
    });
  });

  describe('GET /alertas/:id', () => {
    it('200 - retorna la alerta por ID', async () => {
      mockAlertaCriticaService.obtenerPorId.mockResolvedValue(mockAlerta);

      const res = await request(app.getHttpServer())
        .get('/alertas/alerta-e2e-1')
        .set('Authorization', `Bearer ${token('MEDICO')}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('alerta-e2e-1');
    });
  });

  describe('POST /alertas/escalamiento/procesar', () => {
    it('201 - procesa escalamiento automático con rol ADMIN', async () => {
      mockEscalamientoService.procesarEscalamientoAutomatico.mockResolvedValue(2);

      const res = await request(app.getHttpServer())
        .post('/alertas/escalamiento/procesar')
        .set('Authorization', `Bearer ${token('ADMIN')}`);

      expect(res.status).toBe(201);
      expect(res.body.data.alertas_escaladas).toBe(2);
    });
  });
});