// src/modules/core-client/core-client.module.ts

import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CoreClientService } from './core-client.service';
import { CoreNotifierService } from './core-notifier.service';

@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  providers: [CoreClientService, CoreNotifierService],
  exports: [CoreClientService, CoreNotifierService],
})
export class CoreClientModule {}
