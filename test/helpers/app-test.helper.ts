import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key';

export function generateToken(rol: string, id: string = 'user-test-id'): string {
  return jwt.sign({ id, rol, nombre: 'Test User' }, JWT_SECRET, { expiresIn: '1h' });
}

export function bearerHeader(rol: string): { Authorization: string } {
  return { Authorization: `Bearer ${generateToken(rol)}` };
}

// Mock factories para todos los servicios externos
export const prismaMock = {
  turnos: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  registros_triage: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  alertas_criticas: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  alertas_triage: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  confirmaciones_enfermero: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  pacientes: { findUnique: jest.fn() },
  hospitales: { findUnique: jest.fn() },
  medicos: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  enfermeros: { findUnique: jest.fn(), findMany: jest.fn() },
  usuarios: { findUnique: jest.fn(), findFirst: jest.fn() },
  niveles_triage: { findUnique: jest.fn() },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

export const redisMock = {
  zadd: jest.fn().mockResolvedValue(1),
  zrem: jest.fn().mockResolvedValue(1),
  zrank: jest.fn().mockResolvedValue(0),
  zrange: jest.fn().mockResolvedValue([]),
  hmset: jest.fn().mockResolvedValue('OK'),
  hgetall: jest.fn().mockResolvedValue({}),
  del: jest.fn().mockResolvedValue(1),
  publish: jest.fn().mockResolvedValue(1),
  subscribe: jest.fn(),
  on: jest.fn(),
  quit: jest.fn(),
};

export const triageGatewayMock = {
  emitTurnoCreado: jest.fn(),
  emitPacienteLlamado: jest.fn(),
  emitTriageConfirmado: jest.fn(),
  emitAlertaCritica: jest.fn(),
  emitNotificacion: jest.fn(),
  emitToDashboardEnfermeros: jest.fn(),
  emitToDashboardMedicos: jest.fn(),
  emitToPaciente: jest.fn(),
};

export const eventPublisherMock = {
  publishTurnoCreado: jest.fn().mockResolvedValue(undefined),
  publishPacienteLlamado: jest.fn().mockResolvedValue(undefined),
  publishPacienteAtendido: jest.fn().mockResolvedValue(undefined),
  publishTurnoCancelado: jest.fn().mockResolvedValue(undefined),
  publishTriageConfirmado: jest.fn().mockResolvedValue(undefined),
  publishAlertaCritica: jest.fn().mockResolvedValue(undefined),
  publishAlertaEscalada: jest.fn().mockResolvedValue(undefined),
};

export const coreClientMock = {
  sincronizarPaciente: jest.fn().mockResolvedValue(undefined),
  sincronizarEnfermero: jest.fn().mockResolvedValue(undefined),
  sincronizarMedico: jest.fn().mockResolvedValue(undefined),
};

export const coreNotifierMock = {
  notificarTurnoCreado: jest.fn().mockResolvedValue(undefined),
  notificarPacienteAtendido: jest.fn().mockResolvedValue(undefined),
  notificarTurnoCancelado: jest.fn().mockResolvedValue(undefined),
};

export const classifierMock = {
  clasificar: jest.fn().mockResolvedValue({
    nivel_sugerido: 3,
    confianza: 0.85,
    comentarios: 'Test classification',
    probabilidades: { nivel_1: 0.02, nivel_2: 0.05, nivel_3: 0.85, nivel_4: 0.06, nivel_5: 0.02 },
    feature_mas_importante: 'frecuencia_cardiaca',
    valor_feature_importante: 75,
  }),
};