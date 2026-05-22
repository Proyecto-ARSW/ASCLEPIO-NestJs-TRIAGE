import { Test, TestingModule } from '@nestjs/testing';
import { ConsultasUrgenciaController } from './consultas-urgencias.controller';
import { ConsultasUrgenciaService } from '../services/consultas-urgencia.service';

describe('ConsultasUrgenciaController', () => {
  let controller: ConsultasUrgenciaController;

  const PACIENTE_ID = 'pac-uuid-1234';

  const mockConsultasUrgenciaService = {
    findByPaciente: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsultasUrgenciaController],
      providers: [
        { provide: ConsultasUrgenciaService, useValue: mockConsultasUrgenciaService },
      ],
    }).compile();

    controller = module.get<ConsultasUrgenciaController>(ConsultasUrgenciaController);
    jest.clearAllMocks();
  });

  describe('findByPaciente', () => {
    const respuestaPaginada = {
      data: [{ id: 'c-1', diagnostico: 'Fractura' }],
      total: 1,
      page: 1,
      limit: 5,
    };

    it('debería delegar al servicio con los parámetros correctos', async () => {
      mockConsultasUrgenciaService.findByPaciente.mockResolvedValue(respuestaPaginada);

      const result = await controller.findByPaciente(PACIENTE_ID, 1, 5);

      expect(result).toEqual(respuestaPaginada);
      expect(mockConsultasUrgenciaService.findByPaciente).toHaveBeenCalledWith(
        PACIENTE_ID,
        1,
        5,
      );
    });

    it('debería convertir page y limit a número', async () => {
      mockConsultasUrgenciaService.findByPaciente.mockResolvedValue(respuestaPaginada);

      // Simula que llegan como string desde @Query (comportamiento real de NestJS)
      await controller.findByPaciente(PACIENTE_ID, '2' as any, '10' as any);

      expect(mockConsultasUrgenciaService.findByPaciente).toHaveBeenCalledWith(
        PACIENTE_ID,
        2,
        10,
      );
    });

    it('debería usar valores por defecto page=1 y limit=5 si no se envían', async () => {
      mockConsultasUrgenciaService.findByPaciente.mockResolvedValue({
        ...respuestaPaginada,
        page: 1,
        limit: 5,
      });

      await controller.findByPaciente(PACIENTE_ID, undefined as any, undefined as any);

      expect(mockConsultasUrgenciaService.findByPaciente).toHaveBeenCalledWith(
        PACIENTE_ID,
        1,
        5,
      );
    });
  });
});