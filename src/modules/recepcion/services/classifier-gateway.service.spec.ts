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
    get: jest.fn().mockReturnValue('http://classifier:3003'),
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

  describe('clasificar', () => {
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

    it('debería llamar al clasificador y retornar la clasificación', async () => {
      const mockResponse = {
        data: {
          nivel_sugerido: 3,
          confianza: 0.88,
          probabilidades: { nivel_1: 0.02, nivel_2: 0.03, nivel_3: 0.88, nivel_4: 0.05, nivel_5: 0.02 },
        },
      };
      mockHttpService.axiosRef.post.mockResolvedValue(mockResponse);

      const result = await service.clasificar(payload);

      expect(result.nivel_sugerido).toBe(3);
      expect(result.confianza).toBe(0.88);
      expect(mockHttpService.axiosRef.post).toHaveBeenCalledWith(
        'http://classifier:3003/api/clasificar',
        payload,
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('debería lanzar error cuando el clasificador no responde', async () => {
      mockHttpService.axiosRef.post.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.clasificar(payload)).rejects.toThrow('ECONNREFUSED');
    });

    it('debería usar URL por defecto si CONFIG no está definida', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      // Recrear servicio con config sin URL
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
        expect.stringContaining('/api/clasificar'),
        payload,
        expect.any(Object),
      );
    });
  });
});