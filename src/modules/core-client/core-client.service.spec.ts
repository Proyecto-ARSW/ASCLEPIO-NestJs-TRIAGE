import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { CoreClientService } from './core-client.service';
import { PrismaService } from '@/modules/prisma/prisma.service';

import { Logger } from '@nestjs/common';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
});

describe('CoreClientService', () => {
  let service: CoreClientService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((_key: string, defaultValue: any) => defaultValue ?? ''),
  };

  const mockPrisma = {
    hospitales: { upsert: jest.fn() },
    especialidades: { upsert: jest.fn() },
    usuarios: { findUnique: jest.fn(), upsert: jest.fn() },
    pacientes: { findUnique: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    medicos: { findUnique: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    enfermeros: { findUnique: jest.fn(), upsert: jest.fn() },
    formacion: { upsert: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoreClientService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CoreClientService>(CoreClientService);
    jest.clearAllMocks();
  });

  // ─── onModuleInit ────────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('debería ejecutar sincronizarDatosReferencia sin lanzar errores', async () => {
      mockHttpService.get
        .mockReturnValueOnce(of({ data: [] }))
        .mockReturnValueOnce(of({ data: [] }));

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it('debería continuar aunque sincronizarDatosReferencia falle', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('network down')));

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  // ─── sincronizarDatosReferencia ──────────────────────────────────────────────

  describe('sincronizarDatosReferencia', () => {
    it('debería sincronizar hospitales y especialidades', async () => {
      const hospitales = [{
        id: 1, nombre: 'Hospital Central', activo: true,
        departamento: 'Bogotá', ciudad: 'Bogotá', direccion: 'Calle 1',
      }];
      const especialidades = [{ id: 1, nombre: 'Cardiología', descripcion: null }];

      mockHttpService.get
        .mockReturnValueOnce(of({ data: hospitales }))
        .mockReturnValueOnce(of({ data: especialidades }));
      mockPrisma.hospitales.upsert.mockResolvedValue({});
      mockPrisma.especialidades.upsert.mockResolvedValue({});

      await service.sincronizarDatosReferencia();

      expect(mockPrisma.hospitales.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.especialidades.upsert).toHaveBeenCalledTimes(1);
    });

    it('debería continuar con especialidades aunque hospitales falle', async () => {
      mockHttpService.get
        .mockReturnValueOnce(throwError(() => new Error('timeout')))
        .mockReturnValueOnce(of({ data: [{ id: 1, nombre: 'Cardiología' }] }));
      mockPrisma.especialidades.upsert.mockResolvedValue({});

      await expect(service.sincronizarDatosReferencia()).resolves.not.toThrow();
      expect(mockPrisma.especialidades.upsert).toHaveBeenCalledTimes(1);
    });
  });

  // ─── sincronizarUsuario ──────────────────────────────────────────────────────

  describe('sincronizarUsuario', () => {
    const USUARIO_ID = 'usuario-uuid-1';
    const usuarioLocal = {
      id: USUARIO_ID, nombre: 'Juan', apellido: 'Pérez',
      email: 'juan@test.com', rol: 'PACIENTE', activo: true,
    };

    it('debería retornar el usuario local si ya existe', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue(usuarioLocal);

      const result = await service.sincronizarUsuario(USUARIO_ID);

      expect(result).toEqual(usuarioLocal);
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('debería sincronizar desde Core si no existe localmente', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(of({ data: usuarioLocal }));
      mockPrisma.usuarios.upsert.mockResolvedValue(usuarioLocal);

      const result = await service.sincronizarUsuario(USUARIO_ID);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining(`/sync/usuarios/${USUARIO_ID}`),
        expect.any(Object),
      );
      expect(result).toEqual(usuarioLocal);
    });

    it('debería lanzar Error si Core falla', async () => {
      mockPrisma.usuarios.findUnique.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Network error')));

      await expect(service.sincronizarUsuario(USUARIO_ID)).rejects.toThrow(
        `No se pudo obtener usuario de Core: ${USUARIO_ID}`,
      );
    });
  });

  // ─── sincronizarPaciente ─────────────────────────────────────────────────────

  describe('sincronizarPaciente', () => {
    const PACIENTE_ID = 'paciente-uuid-1';
    const pacienteCore = {
      id: PACIENTE_ID, usuario_id: 'usuario-uuid-1',
      fecha_nacimiento: '1990-05-15', tipo_sangre: 'O+',
      numero_documento: '12345678', tipo_documento: 'CC',
      eps: 'Sura', alergias: null,
    };

    it('debería retornar el paciente local si ya existe', async () => {
      mockPrisma.pacientes.findUnique.mockResolvedValue({ id: PACIENTE_ID });

      const result = await service.sincronizarPaciente(PACIENTE_ID);

      expect(result).toEqual({ id: PACIENTE_ID });
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('debería sincronizar paciente y su usuario desde Core', async () => {
      mockPrisma.pacientes.findUnique.mockResolvedValue(null);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ id: 'usuario-uuid-1' });
      mockHttpService.get.mockReturnValue(of({ data: pacienteCore }));
      mockPrisma.pacientes.upsert.mockResolvedValue({ id: PACIENTE_ID });

      const result = await service.sincronizarPaciente(PACIENTE_ID);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining(`/sync/pacientes/${PACIENTE_ID}`),
        expect.any(Object),
      );
      expect(result).toEqual({ id: PACIENTE_ID });
    });

    it('debería lanzar Error si Core falla', async () => {
      mockPrisma.pacientes.findUnique.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(throwError(() => new Error('timeout')));

      await expect(service.sincronizarPaciente(PACIENTE_ID)).rejects.toThrow(
        `No se pudo obtener paciente de Core: ${PACIENTE_ID}`,
      );
    });
  });

  // ─── buscarPacientePorDocumento ──────────────────────────────────────────────

  describe('buscarPacientePorDocumento', () => {
    const CEDULA = '98765432';
    const pacienteCore = {
      id: 'paciente-1', usuario_id: 'usuario-1', numero_documento: CEDULA,
    };

    it('debería retornar el paciente local si tiene ese documento', async () => {
      mockPrisma.pacientes.findFirst.mockResolvedValue({ id: 'paciente-1' });

      const result = await service.buscarPacientePorDocumento(CEDULA);

      expect(result).toEqual({ id: 'paciente-1' });
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('debería buscar en Core si no existe localmente', async () => {
      mockPrisma.pacientes.findFirst.mockResolvedValue(null);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ id: 'usuario-1' });
      mockHttpService.get.mockReturnValue(of({ data: pacienteCore }));
      mockPrisma.pacientes.upsert.mockResolvedValue({ id: 'paciente-1' });

      const result = await service.buscarPacientePorDocumento(CEDULA);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining(`/sync/pacientes/documento/${CEDULA}`),
        expect.any(Object),
      );
      expect(result).toEqual({ id: 'paciente-1' });
    });

    it('debería lanzar Error si Core falla', async () => {
      mockPrisma.pacientes.findFirst.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(throwError(() => new Error('404')));

      await expect(service.buscarPacientePorDocumento(CEDULA)).rejects.toThrow(
        `No se pudo obtener paciente con cédula ${CEDULA} desde Core`,
      );
    });
  });

  // ─── sincronizarEnfermero ────────────────────────────────────────────────────

  describe('sincronizarEnfermero', () => {
    const ENFERMERO_ID = 'enfermero-uuid-1';
    const enfermeroCore = {
      id: ENFERMERO_ID, usuario_id: 'usuario-uuid-2',
      numero_registro: 'ENF-001', nivel_formacion_id: 1,
      formacion: { nombre: 'Técnico en Enfermería' },
      certificacion_triage: true, activo: true,
    };

    it('debería retornar el enfermero local si ya existe', async () => {
      mockPrisma.enfermeros.findUnique.mockResolvedValue({ id: ENFERMERO_ID });

      const result = await service.sincronizarEnfermero(ENFERMERO_ID);

      expect(result).toEqual({ id: ENFERMERO_ID });
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('debería sincronizar enfermero, formación y usuario desde Core', async () => {
      mockPrisma.enfermeros.findUnique.mockResolvedValue(null);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ id: 'usuario-uuid-2' });
      mockHttpService.get.mockReturnValue(of({ data: enfermeroCore }));
      mockPrisma.formacion.upsert.mockResolvedValue({});
      mockPrisma.enfermeros.upsert.mockResolvedValue({ id: ENFERMERO_ID });

      const result = await service.sincronizarEnfermero(ENFERMERO_ID);

      expect(mockPrisma.formacion.upsert).toHaveBeenCalled();
      expect(result).toEqual({ id: ENFERMERO_ID });
    });

    it('debería lanzar Error si Core falla', async () => {
      mockPrisma.enfermeros.findUnique.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(throwError(() => new Error('500')));

      await expect(service.sincronizarEnfermero(ENFERMERO_ID)).rejects.toThrow(
        `No se pudo obtener enfermero de Core: ${ENFERMERO_ID}`,
      );
    });
  });

  // ─── sincronizarMedico ───────────────────────────────────────────────────────

  describe('sincronizarMedico', () => {
    const MEDICO_ID = 'medico-uuid-1';
    const medicoCore = {
      id: MEDICO_ID, usuario_id: 'usuario-uuid-3',
      especialidad_id: 1, numero_registro: 'MED-001',
      consultorio: 'C-101', activo: true,
    };

    it('debería retornar el médico local si ya existe', async () => {
      mockPrisma.medicos.findUnique.mockResolvedValue({ id: MEDICO_ID });

      const result = await service.sincronizarMedico(MEDICO_ID);

      expect(result).toEqual({ id: MEDICO_ID });
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('debería sincronizar médico desde Core', async () => {
      mockPrisma.medicos.findUnique.mockResolvedValue(null);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ id: 'usuario-uuid-3' });
      mockHttpService.get.mockReturnValue(of({ data: medicoCore }));
      mockPrisma.medicos.upsert.mockResolvedValue({ id: MEDICO_ID });

      const result = await service.sincronizarMedico(MEDICO_ID);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining(`/sync/medicos/${MEDICO_ID}`),
        expect.any(Object),
      );
      expect(result).toEqual({ id: MEDICO_ID });
    });

    it('debería lanzar Error si Core falla', async () => {
      mockPrisma.medicos.findUnique.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(throwError(() => new Error('timeout')));

      await expect(service.sincronizarMedico(MEDICO_ID)).rejects.toThrow(
        `No se pudo obtener médico de Core: ${MEDICO_ID}`,
      );
    });
  });

  // ─── resolverMedicoIdPorUsuario ──────────────────────────────────────────────

  describe('resolverMedicoIdPorUsuario', () => {
    const USUARIO_ID = 'usuario-medico-1';
    const MEDICO_ID = 'medico-uuid-1';

    it('debería retornar el id del médico si existe localmente', async () => {
      mockPrisma.medicos.findFirst.mockResolvedValue({ id: MEDICO_ID });

      const result = await service.resolverMedicoIdPorUsuario(USUARIO_ID);

      expect(result).toBe(MEDICO_ID);
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('debería buscar en Core y sincronizar si no existe localmente', async () => {
      const medicoCore = {
        id: MEDICO_ID, usuario_id: USUARIO_ID,
        especialidad_id: 1, numero_registro: 'MED-001', activo: true,
      };
      mockPrisma.medicos.findFirst.mockResolvedValue(null);
      mockPrisma.medicos.findUnique.mockResolvedValue(null);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ id: USUARIO_ID });
      mockHttpService.get
        .mockReturnValueOnce(of({ data: { id: MEDICO_ID } }))  // resolver
        .mockReturnValueOnce(of({ data: medicoCore }));          // sincronizarMedico
      mockPrisma.medicos.upsert.mockResolvedValue({ id: MEDICO_ID });

      const result = await service.resolverMedicoIdPorUsuario(USUARIO_ID);

      expect(result).toBe(MEDICO_ID);
    });

    it('debería lanzar Error si Core falla', async () => {
      mockPrisma.medicos.findFirst.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(throwError(() => new Error('404')));

      await expect(service.resolverMedicoIdPorUsuario(USUARIO_ID)).rejects.toThrow(
         `No se pudo resolver médico para usuario ${USUARIO_ID}`,
    );
    });
  });
});