// src/modules/tasks/tasks.module.ts

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './tasks.service';
import { AlertasModule } from '../alertas/alertas.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AlertasModule,
  ],
  providers: [TasksService],
})
export class TasksModule {}