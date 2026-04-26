// src/modules/dashboard/dashboard.module.ts

import { Module } from '@nestjs/common';
import { DashboardPacienteService } from './services/dashboard-paciente.service';
import { DashboardRecepcionistaService } from './services/dashboard-recepcionista.service';
import { DashboardEnfermeroService } from './services/dashboard-enfermero.service';
import { DashboardMedicoService } from './services/dashboard-medico.service';
import { DashboardJefeGuardiaService } from './services/dashboard-jefe-guardia.service';
import { DashboardAdminService } from './services/dashboard-admin.service';
import { DashboardController } from './controllers/dashboard.controller';
import { ColaModule } from '../cola/cola.module';
import { ConfirmacionModule } from '../confirmacion/confirmacion.module';

@Module({
  imports: [
    ColaModule,
    ConfirmacionModule,
  ],
  controllers: [DashboardController],
  providers: [
    DashboardPacienteService,
    DashboardRecepcionistaService,
    DashboardEnfermeroService,
    DashboardMedicoService,
    DashboardJefeGuardiaService,
    DashboardAdminService,
  ],
  exports: [
    DashboardPacienteService,
    DashboardRecepcionistaService,
    DashboardEnfermeroService,
    DashboardMedicoService,
    DashboardJefeGuardiaService,
    DashboardAdminService,
  ],
})
export class DashboardModule {}