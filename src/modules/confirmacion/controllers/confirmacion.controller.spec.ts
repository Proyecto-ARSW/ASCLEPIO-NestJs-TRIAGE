import { Test, TestingModule } from '@nestjs/testing';
import { ConfirmacionController } from './confirmacion.controller';
import { ConfirmacionService } from '../services/confirmacion.service';
import { NotFoundException } from '@nestjs/common';

describe('ConfirmacionController', () => {
  let controller: ConfirmacionController;

  const mockConfirmacionService = {
    confirmarTriage: jest.fn(),
    obtenerConfirmacion: jest.fn(),
    obtenerConfirmacionesPorEnfermero: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfirmacionController],
      providers: [{ provide: ConfirmacionService, useValue: mockConfirmacionService }],
    }).compile();

    controller = module.get<ConfirmacionController>(ConfirmacionController);
    jest.clearAllMocks();
  });

  it('confirmarTriage() debería delegar al servicio', async () => {
    const dto = { registro_triage_id: 'reg-1', enfermero_id: 'enf-1', nivel_final: 3 };
    const expected = { confirmacion_id: 'conf-1', nivel_final: 3, posicion_cola: 2 };
    mockConfirmacionService.confirmarTriage.mockResolvedValue(expected);

    const result = await controller.confirmarTriage(dto);

    expect(result).toEqual(expected);
    expect(mockConfirmacionService.confirmarTriage).toHaveBeenCalledWith(dto);
  });

  it('obtenerConfirmacion() debería retornar la confirmación', async () => {
    const conf = { id: 'conf-1', nivel_final_enfermero: 3 };
    mockConfirmacionService.obtenerConfirmacion.mockResolvedValue(conf);

    const result = await controller.obtenerConfirmacion('conf-1');

    expect(result).toEqual(conf);
  });

  it('obtenerConfirmacion() debería propagar NotFoundException', async () => {
    mockConfirmacionService.obtenerConfirmacion.mockRejectedValue(
      new NotFoundException('Confirmación no encontrada'),
    );

    await expect(controller.obtenerConfirmacion('id-inexistente')).rejects.toThrow(NotFoundException);
  });

  it('obtenerConfirmacionesPorEnfermero() debería retornar lista de confirmaciones', async () => {
    const confs = [{ id: 'c1' }, { id: 'c2' }];
    mockConfirmacionService.obtenerConfirmacionesPorEnfermero.mockResolvedValue(confs);

    const result = await controller.obtenerConfirmacionesPorEnfermero('enf-1', 50);

    expect(result).toHaveLength(2);
    expect(mockConfirmacionService.obtenerConfirmacionesPorEnfermero).toHaveBeenCalledWith('enf-1', 50);
  });
});