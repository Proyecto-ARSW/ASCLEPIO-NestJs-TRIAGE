// src/modules/tasks/tasks.module.ts

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './tasks.service';
import { AlertasModule } from '../alertas/alertas.module';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AlertasModule,
    WebsocketsModule,
  ],
  providers: [TasksService],
})
export class TasksModule {}