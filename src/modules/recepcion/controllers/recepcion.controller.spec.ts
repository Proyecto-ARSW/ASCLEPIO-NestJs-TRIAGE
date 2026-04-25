import { Test, TestingModule } from '@nestjs/testing';
import { RecepcionController } from './recepcion.controller';
import { RecepcionService } from '../services/recepcion.service';
import { IngresoTriageDto } from '../dto/ingreso-triage.dto';

describe('RecepcionController', () => {
  let controller: RecepcionController;

  const mockRecepcionService = {
    procesarIngreso: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecepcionController],
      providers: [{ provide: RecepcionService, useValue: mockRecepcionService }],
    }).compile();

    controller = module.get<RecepcionController>(RecepcionController);
    jest.clearAllMocks();
  });

  describe('recibirIngreso', () => {
    it('debería delegar al servicio y retornar el resultado', async () => {
      const dto: Partial<IngresoTriageDto> = {
        paciente_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        hospital_id: 1,
        nivel_preliminar_isisvoice: 3,
      };
      const expected = {
        turno_id: 'turno-1',
        numero_turno: 1,
        nivel_sugerido_ia: 3,
        estado: 'ESPERANDO_CONFIRMACION',
      };
      mockRecepcionService.procesarIngreso.mockResolvedValue(expected);

      const result = await controller.recibirIngreso(dto as IngresoTriageDto);

      expect(result).toEqual(expected);
      expect(mockRecepcionService.procesarIngreso).toHaveBeenCalledWith(dto);
    });
  });
});