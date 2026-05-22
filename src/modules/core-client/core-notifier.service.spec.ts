import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { CoreNotifierService } from './core-notifier.service';

import { Logger } from '@nestjs/common';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
});

describe('CoreNotifierService', () => {
  let service: CoreNotifierService;

  const mockHttpService = { post: jest.fn() };

  const mockConfigService = {
    get: jest.fn().mockImplementation((_key: string, defaultValue: any) => defaultValue ?? ''),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoreNotifierService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CoreNotifierService>(CoreNotifierService);
    jest.clearAllMocks();
  });

  const turnoPayload = {
    turno_id: 'turno-1', numero_turno: 1, hospital_id: 1,
    paciente_id: 'pac-1', tipo_turno: 'URGENCIA',
    estado: 'ESPERANDO_CONFIRMACION', fecha: new Date().toISOString(),
  };

  const canceladoPayload = {
    turno_id: 'turno-1', hospital_id: 1, paciente_id: 'pac-1',
    numero_turno: 1, razon: 'Cancelado por paciente',
  };

  const atendidoPayload = {
    turno_id: 'turno-1', numero_turno: 1, hospital_id: 1,
    paciente_id: 'pac-1', medico_id: 'medico-1', nivel_triage: 3,
    tiempo_espera_minutos: 10, tiempo_atencion_minutos: 20,
    diagnostico: 'Fractura', tratamiento: 'Inmovilización',
  };

  describe('notificarTurnoCreado', () => {
    it('debería enviar POST al endpoint correcto', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200 }));

      await service.notificarTurnoCreado(turnoPayload);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/webhooks/triage/turno-creado'),
        turnoPayload,
        expect.any(Object),
      );
    });

    it('debería completar sin lanzar error aunque Core falle (reintentos agotados)', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => new Error('connection refused')));

      await expect(service.notificarTurnoCreado(turnoPayload)).resolves.not.toThrow();
    }, 15000);
  });

  describe('notificarTurnoCancelado', () => {
    it('debería enviar POST al endpoint correcto', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200 }));

      await service.notificarTurnoCancelado(canceladoPayload);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/webhooks/triage/turno-cancelado'),
        canceladoPayload,
        expect.any(Object),
      );
    });
  });

  describe('notificarPacienteAtendido', () => {
    it('debería enviar POST al endpoint correcto', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200 }));

      await service.notificarPacienteAtendido(atendidoPayload);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/webhooks/triage/paciente-atendido'),
        atendidoPayload,
        expect.any(Object),
      );
    });
  });

  describe('enviarWebhook — comportamiento de reintentos', () => {
    it('debería reintentar exactamente 3 veces antes de rendirse', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => new Error('timeout')));

      await service.notificarTurnoCreado(turnoPayload);

      expect(mockHttpService.post).toHaveBeenCalledTimes(3);
    }, 15000);

    it('debería tener éxito con 1 solo intento si Core responde', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200 }));

      await service.notificarTurnoCreado(turnoPayload);

      expect(mockHttpService.post).toHaveBeenCalledTimes(1);
    });

    it('debería tener éxito en el segundo intento si el primero falla', async () => {
      mockHttpService.post
        .mockReturnValueOnce(throwError(() => new Error('fail')))
        .mockReturnValueOnce(of({ status: 200 }));

      await service.notificarTurnoCreado(turnoPayload);

      expect(mockHttpService.post).toHaveBeenCalledTimes(2);
    }, 10000);
  });
});