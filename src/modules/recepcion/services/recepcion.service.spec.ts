import { Test, TestingModule } from '@nestjs/testing';
import { RecepcionService } from './recepcion.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { ClassifierGatewayService } from './classifier-gateway.service';
import { CoreClientService } from '@/modules/core-client/core-client.service';
import { CoreNotifierService } from '@/modules/core-client/core-notifier.service';
import { TriageGateway } from '@/modules/websockets/gateways/triage.gateway';
import { TriageEventPublisher } from '@/modules/eventos/publishers/triage-event.publisher';
import { IngresoTriageDto } from '../dto/ingreso-triage.dto';

import { Logger } from '@nestjs/common';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
});

describe('RecepcionService', () => {
  let service: RecepcionService;

  const mockPrisma = {
    turnos: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    registros_triage: { create: jest.fn() },
    alertas_criticas: { create: jest.fn() },
  };

  const mockClassifier = { clasificar: jest.fn() };
  const mockCoreClient = {
    sincronizarPaciente: jest.fn(),
    sincronizarEnfermero: jest.fn(),
    buscarPacientePorDocumento: jest.fn(),
  };
  const mockCoreNotifier = { notificarTurnoCreado: jest.fn() };
  const mockTriageGateway = {
    emitToDashboardEnfermeros: jest.fn(),
    emitAlertaCritica: jest.fn(),
  };
  const mockEventPublisher = { publishTurnoCreado: jest.fn() };

  const dtoBase: IngresoTriageDto = {
    paciente_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    hospital_id: 1,
    enfermero_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    motivo_consulta: 'Dolor de cabeza',
    sintomas: ['cefalea'],
    embarazo: false,
    antecedentes: [],
    nivel_preliminar_isisvoice: 3,
    presion_sistolica: 120,
    presion_diastolica: 80,
    frecuencia_cardiaca: 75,
    frecuencia_respiratoria: 16,
    temperatura: 37.0,
    saturacion_oxigeno: 98,
  };

  const mockTurno = {
    id: 'turno-uuid-1',
    numero_turno: 1,
    hospital_id: 1,
    paciente_id: dtoBase.paciente_id,
  };
  const mockRegistro = { id: 'registro-uuid-1' };
  const mockClasificacion = {
    nivel_sugerido: 3,
    confianza: 0.85,
    comentarios: 'Normal',
    probabilidades: {
      nivel_1: 0.01, nivel_2: 0.05, nivel_3: 0.85, nivel_4: 0.07, nivel_5: 0.02,
    },
    feature_mas_importante: 'frecuencia_cardiaca',
    valor_feature_importante: 75,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecepcionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClassifierGatewayService, useValue: mockClassifier },
        { provide: CoreClientService, useValue: mockCoreClient },
        { provide: CoreNotifierService, useValue: mockCoreNotifier },
        { provide: TriageGateway, useValue: mockTriageGateway },
        { provide: TriageEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<RecepcionService>(RecepcionService);
    jest.clearAllMocks();

    mockCoreClient.sincronizarPaciente.mockResolvedValue(undefined);
    mockCoreClient.sincronizarEnfermero.mockResolvedValue(undefined);
    mockCoreNotifier.notificarTurnoCreado.mockResolvedValue(undefined);
    mockEventPublisher.publishTurnoCreado.mockResolvedValue(undefined);
    mockPrisma.turnos.findFirst.mockResolvedValue(null);
    mockPrisma.turnos.create.mockResolvedValue(mockTurno);
    mockPrisma.registros_triage.create.mockResolvedValue(mockRegistro);
    mockPrisma.turnos.update.mockResolvedValue({ ...mockTurno, estado: 'ESPERANDO_CONFIRMACION' });
    mockClassifier.clasificar.mockResolvedValue(mockClasificacion);
  });

  describe('procesarIngreso', () => {
    it('debería procesar el ingreso exitosamente con el clasificador', async () => {
      const result = await service.procesarIngreso(dtoBase);

      expect(result.turno_id).toBe(mockTurno.id);
      expect(result.numero_turno).toBe(1);
      expect(result.registro_triage_id).toBe(mockRegistro.id);
      expect(result.nivel_sugerido_ia).toBe(3);
      expect(result.confianza_ia).toBe(0.85);
      expect(result.estado).toBe('ESPERANDO_CONFIRMACION');
      expect(result.alertas_vitales).toHaveLength(0);
    });

    it('debería sincronizar paciente y enfermero desde Core', async () => {
      await service.procesarIngreso(dtoBase);

      expect(mockCoreClient.sincronizarPaciente).toHaveBeenCalledWith(dtoBase.paciente_id);
      expect(mockCoreClient.sincronizarEnfermero).toHaveBeenCalledWith(dtoBase.enfermero_id);
    });

    it('debería usar clasificación fallback cuando el clasificador falla', async () => {
      mockClassifier.clasificar.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.procesarIngreso(dtoBase);

      expect(result.nivel_sugerido_ia).toBe(dtoBase.nivel_preliminar_isisvoice);
      expect(result.confianza_ia).toBe(0.5);
    });

    it('debería generar numero_turno = 1 si no hay turnos previos hoy', async () => {
      mockPrisma.turnos.findFirst.mockResolvedValue(null);
      mockPrisma.turnos.create.mockResolvedValue({ ...mockTurno, numero_turno: 1 });

      const result = await service.procesarIngreso(dtoBase);

      expect(result.numero_turno).toBe(1);
    });

    it('debería incrementar numero_turno si ya existen turnos hoy', async () => {
      mockPrisma.turnos.findFirst.mockResolvedValue({ numero_turno: 7 });
      mockPrisma.turnos.create.mockResolvedValue({ ...mockTurno, numero_turno: 8 });

      const result = await service.procesarIngreso(dtoBase);

      expect(result.numero_turno).toBe(8);
    });

    it('debería detectar taquicardia (FC > 100) como alerta vital', async () => {
      mockPrisma.alertas_criticas.create.mockResolvedValue({ id: 'alerta-1' });

      const result = await service.procesarIngreso({ ...dtoBase, frecuencia_cardiaca: 110 });

      expect(result.alertas_vitales).toContain('Taquicardia (FC > 100 lpm)');
    });

    it('debería detectar hipoxemia (SpO2 < 92%) como alerta vital', async () => {
      mockPrisma.alertas_criticas.create.mockResolvedValue({ id: 'alerta-1' });

      const result = await service.procesarIngreso({ ...dtoBase, saturacion_oxigeno: 88 });

      expect(result.alertas_vitales).toContain('Hipoxemia (SpO2 < 92%)');
    });

    it('debería detectar hipotensión (PAM < 65) como alerta vital', async () => {
      // PAM = (90 + 2*50) / 3 = 63.3
      mockPrisma.alertas_criticas.create.mockResolvedValue({ id: 'alerta-1' });

      const result = await service.procesarIngreso({
        ...dtoBase, presion_sistolica: 90, presion_diastolica: 50,
      });

      expect(result.alertas_vitales).toContain('Hipotensión (PAM < 65 mmHg)');
    });

    it('debería detectar fiebre alta (T > 39°C) como alerta vital', async () => {
      mockPrisma.alertas_criticas.create.mockResolvedValue({ id: 'alerta-1' });

      const result = await service.procesarIngreso({ ...dtoBase, temperatura: 39.5 });

      expect(result.alertas_vitales).toContain('Fiebre alta (T > 39°C)');
    });

    it('debería detectar taquipnea (FR > 24) y shock index elevado', async () => {
      // SI = 110/80 = 1.375 > 1.0
      mockPrisma.alertas_criticas.create.mockResolvedValue({ id: 'alerta-1' });

      const result = await service.procesarIngreso({
        ...dtoBase,
        frecuencia_respiratoria: 26,
        frecuencia_cardiaca: 110,
        presion_sistolica: 80,
      });

      expect(result.alertas_vitales).toContain('Taquipnea (FR > 24 rpm)');
      expect(result.alertas_vitales).toContain('Shock Index elevado (SI > 1.0)');
    });

    it('debería crear alerta crítica y emitir WebSocket cuando hay alertas vitales', async () => {
      mockPrisma.alertas_criticas.create.mockResolvedValue({ id: 'alerta-critica-1' });

      await service.procesarIngreso({ ...dtoBase, saturacion_oxigeno: 85 });

      expect(mockPrisma.alertas_criticas.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ turno_id: mockTurno.id }),
        }),
      );
      expect(mockTriageGateway.emitAlertaCritica).toHaveBeenCalled();
    });

    it('NO debería crear alerta crítica si no hay alertas vitales', async () => {
      await service.procesarIngreso(dtoBase);

      expect(mockPrisma.alertas_criticas.create).not.toHaveBeenCalled();
      expect(mockTriageGateway.emitAlertaCritica).not.toHaveBeenCalled();
    });

    it('debería notificar WebSocket al dashboard de enfermeros', async () => {
      await service.procesarIngreso(dtoBase);

      expect(mockTriageGateway.emitToDashboardEnfermeros).toHaveBeenCalledWith(
        dtoBase.hospital_id,
        'clasificacion:lista',
        expect.objectContaining({ turno_id: mockTurno.id }),
      );
    });

    it('debería publicar evento RabbitMQ de turno creado', async () => {
      await service.procesarIngreso(dtoBase);

      expect(mockEventPublisher.publishTurnoCreado).toHaveBeenCalledWith(
        expect.objectContaining({
          turno_id: mockTurno.id,
          hospital_id: dtoBase.hospital_id,
          tipo_turno: 'URGENCIA',
        }),
      );
    });
  });
});