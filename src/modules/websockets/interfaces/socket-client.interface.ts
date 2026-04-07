// src/modules/websockets/interfaces/socket-client.interface.ts

import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    rol: string;
    nombre?: string;
    apellido?: string;
  };
  hospital_id?: number;
  dashboard_type?: 'enfermero' | 'medico' | 'pantalla';
}