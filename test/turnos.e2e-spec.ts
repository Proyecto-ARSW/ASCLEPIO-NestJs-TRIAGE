import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { TurnoController } from '../src/modules/turnos/controllers/turno.controller';
import { TurnoService } from '../src/modules/turnos/services/turno.service';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { EstadoTurno, TipoTurno } from '../src/modules/turnos/entities/turno.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

const JWT_SECRET = 'test-secret';

function token(rol: string) {
  return jwt.sign({ id: 'user-test', rol }, JWT_SECRET);
}

describe('Turnos (e2e)', () => {
  let app: INestApplication;

  const baseTurno = {
    id: 'turno-e2e-uuid',
    numero_turno: 1,
    hospital_id: 1,
    paciente_id: 'pac-uuid',
    tipo_turno: TipoTurno.URGENCIA,
    estado: EstadoTurno.EN_ESPERA,
    nivel_triage_id: 3,
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
  };

  const mockTurnoService = {
    crearTurnoUrgencia: jest.fn(),
    obtenerPorId: jest.fn(),
    obtenerPorHospital: jest.fn(),
    actualizarEstado: jest.fn(),
    llamarPaciente: jest.fn(),
    finalizarTurno: jest.fn(),
    cancelarTurno: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TurnoController],
      providers: [
        { provide: TurnoService, useValue: mockTurnoService },
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

  describe('POST /turnos', () => {
    it('201 - crea turno con rol RECEPCIONISTA', async () => {
      mockTurnoService.crearTurnoUrgencia.mockResolvedValue(baseTurno);

      const res = await request(app.getHttpServer())
        .post('/turnos')
        .set('Authorization', `Bearer ${token('RECEPCIONISTA')}`)
        .send({ paciente_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', hospital_id: 1 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(baseTurno.id);
    });

    it('201 - crea turno con rol ENFERMERO', async () => {
      mockTurnoService.crearTurnoUrgencia.mockResolvedValue(baseTurno);

      const res = await request(app.getHttpServer())
        .post('/turnos')
        .set('Authorization', `Bearer ${token('ENFERMERO')}`)
        .send({ paciente_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', hospital_id: 1 });

      expect(res.status).toBe(201);
    });

    it('404 - lanza 404 cuando el paciente no existe', async () => {
      mockTurnoService.crearTurnoUrgencia.mockRejectedValue(new NotFoundException('Paciente no encontrado'));

      const res = await request(app.getHttpServer())
        .post('/turnos')
        .set('Authorization', `Bearer ${token('RECEPCIONISTA')}`)
        .send({ paciente_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', hospital_id: 1 });

      expect(res.status).toBe(404);
    });

    it('401 - rechaza petición sin token', async () => {
      const res = await request(app.getHttpServer())
        .post('/turnos')
        .send({ paciente_id: 'pac-1', hospital_id: 1 });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /turnos/:id', () => {
    it('200 - retorna el turno existente', async () => {
      mockTurnoService.obtenerPorId.mockResolvedValue(baseTurno);

      const res = await request(app.getHttpServer())
        .get('/turnos/turno-e2e-uuid')
        .set('Authorization', `Bearer ${token('MEDICO')}`);

      expect(res.status).toBe(200);
      expect(res.body.data.numero_turno).toBe(1);
    });

    it('404 - retorna 404 si el turno no existe', async () => {
      mockTurnoService.obtenerPorId.mockRejectedValue(new NotFoundException('Turno no encontrado'));

      const res = await request(app.getHttpServer())
        .get('/turnos/id-inexistente')
        .set('Authorization', `Bearer ${token('MEDICO')}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /turnos/hospital/:hospital_id', () => {
    it('200 - retorna lista de turnos del hospital', async () => {
      mockTurnoService.obtenerPorHospital.mockResolvedValue([baseTurno, baseTurno]);

      const res = await request(app.getHttpServer())
        .get('/turnos/hospital/1')
        .set('Authorization', `Bearer ${token('MEDICO')}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
    });

    it('200 - acepta filtro por estado en query', async () => {
      mockTurnoService.obtenerPorHospital.mockResolvedValue([baseTurno]);

      const res = await request(app.getHttpServer())
        .get('/turnos/hospital/1?estado=EN_ESPERA')
        .set('Authorization', `Bearer ${token('MEDICO')}`);

      expect(res.status).toBe(200);
      expect(mockTurnoService.obtenerPorHospital).toHaveBeenCalledWith(
        1, undefined, EstadoTurno.EN_ESPERA,
      );
    });
  });

  describe('PUT /turnos/:id/estado', () => {
    it('200 - actualiza el estado del turno', async () => {
      const actualizado = { ...baseTurno, estado: EstadoTurno.EN_CONSULTA };
      mockTurnoService.actualizarEstado.mockResolvedValue(actualizado);

      const res = await request(app.getHttpServer())
        .put('/turnos/turno-e2e-uuid/estado')
        .set('Authorization', `Bearer ${token('ENFERMERO')}`)
        .send({ estado: 'EN_CONSULTA' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /turnos/:id/llamar', () => {
    it('200 - llama al paciente correctamente con rol MEDICO', async () => {
      const turnoLlamado = { ...baseTurno, estado: EstadoTurno.EN_CONSULTA };
      mockTurnoService.llamarPaciente.mockResolvedValue(turnoLlamado);

      const res = await request(app.getHttpServer())
        .put('/turnos/turno-e2e-uuid/llamar')
        .set('Authorization', `Bearer ${token('MEDICO')}`)
        .send({ medico_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', consultorio: 'Consultorio 3' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('400 - rechaza si el turno no está EN_ESPERA', async () => {
      mockTurnoService.llamarPaciente.mockRejectedValue(
        new BadRequestException('El turno debe estar en estado EN_ESPERA'),
      );

      const res = await request(app.getHttpServer())
        .put('/turnos/turno-e2e-uuid/llamar')
        .set('Authorization', `Bearer ${token('MEDICO')}`)
        .send({ medico_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', consultorio: 'C1' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /turnos/:id/finalizar', () => {
    it('200 - finaliza el turno con diagnóstico y tratamiento', async () => {
      const turnoAtendido = { ...baseTurno, estado: EstadoTurno.ATENDIDO };
      mockTurnoService.finalizarTurno.mockResolvedValue(turnoAtendido);

      const res = await request(app.getHttpServer())
        .put('/turnos/turno-e2e-uuid/finalizar')
        .set('Authorization', `Bearer ${token('MEDICO')}`)
        .send({
          medico_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          diagnostico: 'Gripe estacional',
          tratamiento: 'Reposo y analgésicos',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.estado).toBe(EstadoTurno.ATENDIDO);
    });

    it('400 - rechaza si el turno no está EN_CONSULTA', async () => {
      mockTurnoService.finalizarTurno.mockRejectedValue(
        new BadRequestException('El turno debe estar en estado EN_CONSULTA'),
      );

      const res = await request(app.getHttpServer())
        .put('/turnos/turno-e2e-uuid/finalizar')
        .set('Authorization', `Bearer ${token('MEDICO')}`)
        .send({ medico_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', diagnostico: 'x', tratamiento: 'y' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /turnos/:id', () => {
    it('200 - cancela el turno con rol ADMIN', async () => {
      const cancelado = { ...baseTurno, estado: EstadoTurno.CANCELADO };
      mockTurnoService.cancelarTurno.mockResolvedValue(cancelado);

      const res = await request(app.getHttpServer())
        .delete('/turnos/turno-e2e-uuid')
        .set('Authorization', `Bearer ${token('ADMIN')}`);

      expect(res.status).toBe(200);
      expect(res.body.data.estado).toBe(EstadoTurno.CANCELADO);
    });

    it('404 - retorna 404 si el turno no existe', async () => {
      mockTurnoService.cancelarTurno.mockRejectedValue(new NotFoundException('Turno no encontrado'));

      const res = await request(app.getHttpServer())
        .delete('/turnos/id-inexistente')
        .set('Authorization', `Bearer ${token('ADMIN')}`);

      expect(res.status).toBe(404);
    });
  });
});