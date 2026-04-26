import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  function createMockContext(userRol?: string, requiredRoles?: string[]): ExecutionContext {
    const context = {
      getType: () => 'http',
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: userRol ? { id: 'user-1', rol: userRol } : null,
        }),
      }),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles || null);
    return context;
  }

  it('debería permitir si no se especifican roles requeridos', () => {
    const context = createMockContext('ENFERMERO', undefined);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('debería permitir si el usuario tiene el rol requerido', () => {
    const context = createMockContext('MEDICO', ['MEDICO', 'ADMIN']);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('debería rechazar si el usuario no tiene ninguno de los roles requeridos', () => {
    const context = createMockContext('ENFERMERO', ['MEDICO', 'ADMIN']);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it('debería rechazar si no hay usuario en la petición', () => {
    const context = createMockContext(undefined, ['MEDICO']);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it('debería usar reflector con ROLES_KEY', () => {
    const context = createMockContext('ADMIN', ['ADMIN']);
    const spy = jest.spyOn(reflector, 'getAllAndOverride');

    guard.canActivate(context);

    expect(spy).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });

  it('debería manejar rol RECEPCIONISTA correctamente', () => {
    const context = createMockContext('RECEPCIONISTA', ['RECEPCIONISTA', 'ADMIN']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('debería manejar rol JEFE_GUARDIA correctamente', () => {
    const context = createMockContext('JEFE_GUARDIA', ['JEFE_GUARDIA', 'ADMIN']);

    expect(guard.canActivate(context)).toBe(true);
  });
});