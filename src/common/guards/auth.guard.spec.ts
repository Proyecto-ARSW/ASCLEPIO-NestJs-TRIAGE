import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard';
import * as jwt from 'jsonwebtoken';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  const JWT_SECRET = 'test-secret-key-for-testing';

  const mockConfigService = {
    get: jest.fn().mockReturnValue(JWT_SECRET),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  function createMockContext(authHeader?: string): ExecutionContext {
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          headers: authHeader ? { authorization: authHeader } : {},
          user: null,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('debería permitir la petición con un JWT válido', async () => {
    const token = jwt.sign({ id: 'user-1', rol: 'ENFERMERO' }, JWT_SECRET, { expiresIn: '1h' });
    const context = createMockContext(`Bearer ${token}`);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('debería lanzar UnauthorizedException si no hay token', async () => {
    const context = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('No se proporcionó token');
  });

  it('debería lanzar UnauthorizedException si el token es inválido', async () => {
    const context = createMockContext('Bearer token-invalido-123');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Token inválido');
  });

  it('debería lanzar UnauthorizedException si el token está expirado', async () => {
    const token = jwt.sign({ id: 'user-1', rol: 'ENFERMERO' }, JWT_SECRET, { expiresIn: -1 });
    const context = createMockContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('debería rechazar si el header no usa esquema Bearer', async () => {
    const context = createMockContext('Basic dXNlcjpwYXNz');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('debería asignar el payload del JWT al request.user', async () => {
    const payload = { id: 'user-1', rol: 'MEDICO', nombre: 'Dr. Juan' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const request: any = { headers: { authorization: `Bearer ${token}` } };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await guard.canActivate(context);

    expect(request.user).toMatchObject({ id: 'user-1', rol: 'MEDICO' });
  });
});