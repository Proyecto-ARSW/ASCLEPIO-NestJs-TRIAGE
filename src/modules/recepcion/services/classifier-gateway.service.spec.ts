import { Test, TestingModule } from '@nestjs/testing';
import { ClassifierGatewayService } from './classifier-gateway.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

describe('ClassifierGatewayService', () => {
  let service: ClassifierGatewayService;

  const mockHttpService = {
    axiosRef: {
      post: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://classifier-host:8000'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassifierGatewayService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ClassifierGatewayService>(ClassifierGatewayService);
    jest.clearAllMocks();
  });

  const payload = {
    sintomas: ['cefalea'],
    embarazo: false,
    antecedentes: [],
    nivel_preliminar: 3,
    presion_sistolica: 120,
    presion_diastolica: 80,
    frecuencia_cardiaca: 75,
    frecuencia_respiratoria: 16,
    temperatura: 37.0,
    saturacion_oxigeno: 98,
    presion_arterial_media: 93.3,
    shock_index: 0.625,
  };

  describe('clasificar', () => {
    it('debería llamar al endpoint correcto y retornar la clasificación', async () => {
      const mockResponse = {
        data: {
          nivel_sugerido: 3,
          confianza: 0.88,
          probabilidades: { nivel_1: 0.02, nivel_2: 0.03, nivel_3: 0.88, nivel_4: 0.05, nivel_5: 0.02 },
          feature_mas_importante: 'frecuencia_cardiaca',
          valor_feature_importante: 75,
        },
      };
      mockHttpService.axiosRef.post.mockResolvedValue(mockResponse);

      const result = await service.clasificar(payload);

      expect(result.nivel_sugerido).toBe(3);
      expect(result.confianza).toBe(0.88);
      expect(result.probabilidades).toEqual(mockResponse.data.probabilidades);
      // El service envuelve el payload en { triage_data: {...} }
      expect(mockHttpService.axiosRef.post).toHaveBeenCalledWith(
        'http://classifier-host:8000/api/v1/predict/triage',
        expect.objectContaining({ triage_data: expect.any(Object) }),
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('debería usar nivel_triage como fallback si nivel_sugerido es undefined', async () => {
      const mockResponse = {
        data: { nivel_triage: 2, confianza: 0.7 },
      };
      mockHttpService.axiosRef.post.mockResolvedValue(mockResponse);

      const result = await service.clasificar(payload);

      expect(result.nivel_sugerido).toBe(2);
    });

    it('debería usar probabilidades vacías cuando el response no las incluye', async () => {
      const mockResponse = {
        data: { nivel_sugerido: 3, confianza: 0.6 },
      };
      mockHttpService.axiosRef.post.mockResolvedValue(mockResponse);

      const result = await service.clasificar(payload);

      expect(result.probabilidades).toEqual({ nivel_1: 0, nivel_2: 0, nivel_3: 0, nivel_4: 0, nivel_5: 0 });
    });

    it('debería propagar el error cuando el clasificador no responde', async () => {
      mockHttpService.axiosRef.post.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.clasificar(payload)).rejects.toThrow('ECONNREFUSED');
    });

    it('debería usar la URL de fallback cuando CONFIG no está definida', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ClassifierGatewayService,
          { provide: HttpService, useValue: mockHttpService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      const svc = module.get<ClassifierGatewayService>(ClassifierGatewayService);
      mockHttpService.axiosRef.post.mockResolvedValue({ data: { nivel_sugerido: 3, confianza: 0.5 } });

      await svc.clasificar(payload);

      expect(mockHttpService.axiosRef.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/predict/triage'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('debería mapear los vitales al formato que espera el clasificador (vital_signs)', async () => {
      mockHttpService.axiosRef.post.mockResolvedValue({
        data: { nivel_sugerido: 3, confianza: 0.75 },
      });

      await service.clasificar(payload);

      const callArgs = mockHttpService.axiosRef.post.mock.calls[0][1];
      expect(callArgs.triage_data.vital_signs).toMatchObject({
        temperature_c: payload.temperatura,
        heart_rate_bpm: payload.frecuencia_cardiaca,
        respiratory_rate_bpm: payload.frecuencia_respiratoria,
        oxygen_saturation_pct: payload.saturacion_oxigeno,
        systolic_bp_mmhg: payload.presion_sistolica,
        diastolic_bp_mmhg: payload.presion_diastolica,
      });
    });
  });
});