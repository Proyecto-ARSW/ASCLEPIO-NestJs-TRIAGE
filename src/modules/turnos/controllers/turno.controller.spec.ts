import { Test, TestingModule } from '@nestjs/testing';
import { TurnoController } from './turno.controller';
import { TurnoService } from '../services/turno.service';
import { AuthGuard } from '@/common/guards/auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { EstadoTurno, TipoTurno } from '../entities/turno.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TurnoController', () => {
  let controller: TurnoController;

  const mockTurno = {
    id: 'turno-1',
    numero_turno: 1,
    hospital_id: 1,
    paciente_id: 'pac-1',
    tipo_turno: TipoTurno.URGENCIA,
    estado: EstadoTurno.EN_ESPERA,
    creado_en: new Date(),
    actualizado_en: new Date(),
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
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TurnoController],
      providers: [{ provide: TurnoService, useValue: mockTurnoService }],
    })
      .overrideGuard(AuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TurnoController>(TurnoController);
    jest.clearAllMocks();
  });

  it('crear() debería retornar { success: true, data, mensaje }', async () => {
    mockTurnoService.crearTurnoUrgencia.mockResolvedValue(mockTurno);

    const result = await controller.crear({ paciente_id: 'pac-1', hospital_id: 1 });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockTurno);
    expect(result.mensaje).toContain('1');
  });

  it('obtenerPorId() debería retornar { success: true, data }', async () => {
    mockTurnoService.obtenerPorId.mockResolvedValue(mockTurno);

    const result = await controller.obtenerPorId('turno-1');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockTurno);
  });

  it('obtenerPorId() debería propagar NotFoundException', async () => {
    mockTurnoService.obtenerPorId.mockRejectedValue(new NotFoundException('Turno no encontrado'));

    await expect(controller.obtenerPorId('id-inexistente')).rejects.toThrow(NotFoundException);
  });

  it('obtenerPorHospital() debería retornar lista con total', async () => {
    mockTurnoService.obtenerPorHospital.mockResolvedValue([mockTurno, mockTurno]);

    const result = await controller.obtenerPorHospital('1');

    expect(result.success).toBe(true);
    expect(result.total).toBe(2);
  });

  it('actualizarEstado() debería retornar turno actualizado', async () => {
    const actualizado = { ...mockTurno, estado: EstadoTurno.EN_CONSULTA };
    mockTurnoService.actualizarEstado.mockResolvedValue(actualizado);

    const result = await controller.actualizarEstado('turno-1', { estado: EstadoTurno.EN_CONSULTA });

    expect(result.success).toBe(true);
    expect(result.data.estado).toBe(EstadoTurno.EN_CONSULTA);
  });

  it('llamarPaciente() debería propagar BadRequestException si estado inválido', async () => {
    mockTurnoService.llamarPaciente.mockRejectedValue(
      new BadRequestException('El turno debe estar en estado EN_ESPERA'),
    );

    await expect(
      controller.llamarPaciente('turno-1', { medico_id: 'med-1', consultorio: 'C1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('finalizarTurno() debería retornar turno finalizado', async () => {
    const finalizado = { ...mockTurno, estado: EstadoTurno.ATENDIDO };
    mockTurnoService.finalizarTurno.mockResolvedValue(finalizado);

    const result = await controller.finalizarTurno('turno-1', {
      medico_id: 'med-1',
      diagnostico: 'Gripe',
      tratamiento: 'Reposo',
    });

    expect(result.success).toBe(true);
    expect(result.data.estado).toBe(EstadoTurno.ATENDIDO);
  });

  it('cancelarTurno() debería retornar turno cancelado', async () => {
    const cancelado = { ...mockTurno, estado: EstadoTurno.CANCELADO };
    mockTurnoService.cancelarTurno.mockResolvedValue(cancelado);

    const result = await controller.cancelarTurno('turno-1');

    expect(result.success).toBe(true);
    expect(result.data.estado).toBe(EstadoTurno.CANCELADO);
  });
});