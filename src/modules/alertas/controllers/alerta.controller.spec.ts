import { Test, TestingModule } from '@nestjs/testing';
import { AlertaController } from './alerta.controller';
import { AlertaCriticaService } from '../services/alerta-critica.service';
import { AlertaTriageService } from '../services/alerta-triage.service';
import { EscalamientoService } from '../services/escalamiento.service';
import { AuthGuard } from '@/common/guards/auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { NotFoundException } from '@nestjs/common';

describe('AlertaController', () => {
  let controller: AlertaController;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertaController],
      providers: [
        { provide: AlertaCriticaService, useValue: mockAlertaCriticaService },
        { provide: AlertaTriageService, useValue: mockAlertaTriageService },
        { provide: EscalamientoService, useValue: mockEscalamientoService },
      ],
    })
      .overrideGuard(AuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AlertaController>(AlertaController);
    jest.clearAllMocks();
  });

  it('crearAlertaCritica() debería retornar { success: true, data }', async () => {
    const dto = { turno_id: 'turno-1', hospital_id: 1, nivel_triage: 1, tipo_alerta: 'TRIAGE_CRITICO' as any };
    const resultado = { alerta: { id: 'alerta-1' }, mensaje: 'Alerta creada', notificado_a: [] };
    mockAlertaCriticaService.crearAlerta.mockResolvedValue(resultado);

    const result = await controller.crearAlertaCritica(dto);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(resultado);
  });

  it('confirmarAlerta() debería retornar alerta confirmada', async () => {
    const alerta = { id: 'alerta-1', confirmada: true };
    mockAlertaCriticaService.confirmarAlerta.mockResolvedValue(alerta);

    const result = await controller.confirmarAlerta('alerta-1', { medico_id: 'med-1' });

    expect(result.success).toBe(true);
    expect(result.data.confirmada).toBe(true);
  });

  it('escalarAlerta() debería retornar alerta escalada', async () => {
    const alerta = { id: 'alerta-1', escalada: true };
    mockEscalamientoService.escalarAlerta.mockResolvedValue(alerta);

    const result = await controller.escalarAlerta('alerta-1', {
      jefe_guardia_id: 'jefe-1',
      razon_escalamiento: 'Sin atención',
    });

    expect(result.success).toBe(true);
    expect(result.data.escalada).toBe(true);
  });

  it('obtenerAlertasHospital() debería retornar alertas críticas y de tiempo', async () => {
    mockAlertaCriticaService.obtenerAlertasActivas.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    mockAlertaTriageService.obtenerAlertasActivas.mockResolvedValue([{ id: 'b1' }]);

    const result = await controller.obtenerAlertasHospital('1');

    expect(result.success).toBe(true);
    expect(result.data.total_criticas).toBe(2);
    expect(result.data.total_tiempo_espera).toBe(1);
  });

  it('obtenerAlerta() debería lanzar NotFoundException si no existe', async () => {
    mockAlertaCriticaService.obtenerPorId.mockRejectedValue(new NotFoundException('Alerta no encontrada'));

    await expect(controller.obtenerAlerta('id-inexistente')).rejects.toThrow(NotFoundException);
  });

  it('procesarEscalamientoAutomatico() debería retornar cantidad de alertas escaladas', async () => {
    mockEscalamientoService.procesarEscalamientoAutomatico.mockResolvedValue(3);

    const result = await controller.procesarEscalamientoAutomatico();

    expect(result.success).toBe(true);
    expect(result.data.alertas_escaladas).toBe(3);
    expect(result.mensaje).toContain('3');
  });
});