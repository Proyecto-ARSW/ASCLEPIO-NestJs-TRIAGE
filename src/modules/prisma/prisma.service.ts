import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma conectado');
    } catch (error: any) {
      this.logger.error(`Error conectando a Prisma: ${error?.message || error}`);
      this.logger.warn('El servicio continuará sin base de datos disponible');
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch (error: any) {
      this.logger.error(`Error desconectando Prisma: ${error?.message || error}`);
    }
  }
}