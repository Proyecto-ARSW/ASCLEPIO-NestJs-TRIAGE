export interface UsuarioRequest {
  id: string;
  email: string;
  rol: string;
  nombre: string;
  apellido: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: UsuarioRequest;
    }
  }
}