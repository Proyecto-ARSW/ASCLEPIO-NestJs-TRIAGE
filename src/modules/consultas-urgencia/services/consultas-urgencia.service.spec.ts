import { Test, TestingModule } from '@nestjs/testing';
import { ConsultasUrgenciaService } from './consultas-urgencia.service';
import { PrismaService } from '@/modules/prisma/prisma.service';

describe('ConsultasUrgenciaService', () => {
  let service: ConsultasUrgenciaService;

  const PACIENTE_ID = 'pac-uuid-1234';

  const consultaBase = {
    id: 'consulta-1',
    turno_id: 'turno-1',
    diagnostico: 'Fractura de muñeca',
    tratamiento: 'Inmovilización',
    observaciones: 'Reposo 2 semanas',
    nivel_triage: 3,
    creado_en: new Date('2024-01-15T10:00:00Z'),
    medicos: { usuario_id: 'usuario-medico-1' },
  };

  const usuarioMedico = {
    id: 'usuario-medico-1',
    nombre: 'Carlos',
    apellido: 'Pérez',
  };

  const mockPrisma = {
    consultas_urgencia: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    usuarios: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsultasUrgenciaService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConsultasUrgenciaService>(ConsultasUrgenciaService);
    jest.clearAllMocks();
  });

  describe('findByPaciente', () => {
    it('debería retornar consultas paginadas con nombre del médico', async () => {
      mockPrisma.consultas_urgencia.findMany.mockResolvedValue([consultaBase]);
      mockPrisma.consultas_urgencia.count.mockResolvedValue(1);
      mockPrisma.usuarios.findMany.mockResolvedValue([usuarioMedico]);

      const result = await service.findByPaciente(PACIENTE_ID, 1, 5);

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as any).medico_nombre).toBe('Dr. Carlos Pérez');
    });

    it('debería calcular correctamente el skip según la página', async () => {
      mockPrisma.consultas_urgencia.findMany.mockResolvedValue([]);
      mockPrisma.consultas_urgencia.count.mockResolvedValue(0);
      mockPrisma.usuarios.findMany.mockResolvedValue([]);

      await service.findByPaciente(PACIENTE_ID, 3, 10);

      expect(mockPrisma.consultas_urgencia.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('debería filtrar por paciente_id', async () => {
      mockPrisma.consultas_urgencia.findMany.mockResolvedValue([]);
      mockPrisma.consultas_urgencia.count.mockResolvedValue(0);
      mockPrisma.usuarios.findMany.mockResolvedValue([]);

      await service.findByPaciente(PACIENTE_ID, 1, 5);

      expect(mockPrisma.consultas_urgencia.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { paciente_id: PACIENTE_ID },
        }),
      );
      expect(mockPrisma.consultas_urgencia.count).toHaveBeenCalledWith({
        where: { paciente_id: PACIENTE_ID },
      });
    });

    it('debería retornar "Médico desconocido" si el usuario del médico no existe', async () => {
      mockPrisma.consultas_urgencia.findMany.mockResolvedValue([consultaBase]);
      mockPrisma.consultas_urgencia.count.mockResolvedValue(1);
      // usuario no encontrado
      mockPrisma.usuarios.findMany.mockResolvedValue([]);

      const result = await service.findByPaciente(PACIENTE_ID, 1, 5);

      expect((result.data[0] as any).medico_nombre).toBe('Médico desconocido');
    });

    it('debería retornar data vacía y total 0 cuando no hay consultas', async () => {
      mockPrisma.consultas_urgencia.findMany.mockResolvedValue([]);
      mockPrisma.consultas_urgencia.count.mockResolvedValue(0);
      mockPrisma.usuarios.findMany.mockResolvedValue([]);

      const result = await service.findByPaciente(PACIENTE_ID, 1, 5);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('NO debería consultar usuarios si la lista de consultas está vacía', async () => {
      mockPrisma.consultas_urgencia.findMany.mockResolvedValue([]);
      mockPrisma.consultas_urgencia.count.mockResolvedValue(0);

      await service.findByPaciente(PACIENTE_ID, 1, 5);

      expect(mockPrisma.usuarios.findMany).not.toHaveBeenCalled();
    });

    it('debería deduplicar usuario_ids de médicos antes de consultarlos', async () => {
      const consultaExtra = {
        ...consultaBase,
        id: 'consulta-2',
        medicos: { usuario_id: 'usuario-medico-1' }, // mismo médico
      };
      mockPrisma.consultas_urgencia.findMany.mockResolvedValue([
        consultaBase,
        consultaExtra,
      ]);
      mockPrisma.consultas_urgencia.count.mockResolvedValue(2);
      mockPrisma.usuarios.findMany.mockResolvedValue([usuarioMedico]);

      await service.findByPaciente(PACIENTE_ID, 1, 5);

      // Solo debe hacer 1 consulta de usuarios con el id único
      expect(mockPrisma.usuarios.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['usuario-medico-1'] } },
        }),
      );
    });

    it('debería incluir los campos correctos en cada elemento del resultado', async () => {
      mockPrisma.consultas_urgencia.findMany.mockResolvedValue([consultaBase]);
      mockPrisma.consultas_urgencia.count.mockResolvedValue(1);
      mockPrisma.usuarios.findMany.mockResolvedValue([usuarioMedico]);

      const result = await service.findByPaciente(PACIENTE_ID, 1, 5);

      const item = result.data[0] as any;
      expect(item).toMatchObject({
        id: 'consulta-1',
        turno_id: 'turno-1',
        diagnostico: 'Fractura de muñeca',
        tratamiento: 'Inmovilización',
        observaciones: 'Reposo 2 semanas',
        nivel_triage: 3,
        medico_nombre: 'Dr. Carlos Pérez',
      });
      expect(item.creado_en).toBeInstanceOf(Date);
    });
  });
});