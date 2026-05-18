import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CoreClientService implements OnModuleInit {
  private readonly logger = new Logger(CoreClientService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get coreUrl(): string {
    return this.configService.get<string>('CORE_API_URL', 'http://localhost:3000');
  }

  private get apiKey(): string {
    return this.configService.get<string>('CORE_API_KEY', '');
  }

  private get headers() {
    return { 'x-api-key': this.apiKey };
  }

  async onModuleInit() {
    try {
      await this.sincronizarDatosReferencia();
    } catch (error: any) {
      this.logger.error(`Error en sincronización inicial: ${error?.message}`);
      this.logger.warn('El servicio continuará, pero algunos datos de referencia podrían faltar');
    }
  }

  async sincronizarDatosReferencia(): Promise<void> {
    this.logger.log('Sincronizando datos de referencia desde Core...');
    await this.sincronizarHospitales();
    await this.sincronizarEspecialidades();
    this.logger.log('Sincronización de datos de referencia completada');
  }

  private async sincronizarHospitales(): Promise<void> {
    try {
      const { data: hospitales } = await firstValueFrom(
        this.httpService.get(`${this.coreUrl}/sync/hospitales`, {
          headers: this.headers,
          timeout: 10000,
        }),
      );

      for (const h of hospitales) {
        await this.prisma.hospitales.upsert({
          where: { id: h.id },
          update: {
            nombre: h.nombre,
            activo: h.activo,
            actualizado_en: new Date(),
          },
          create: {
            id: h.id,
            nombre: h.nombre,
            nit: h.nit || null,
            departamento: h.departamento || 'N/A',
            ciudad: h.ciudad || 'N/A',
            direccion: h.direccion || 'N/A',
            telefono: h.telefono || null,
            activo: h.activo ?? true,
          },
        });
      }

      this.logger.log(`Sincronizados ${hospitales.length} hospitales`);
    } catch (error: any) {
      this.logger.error(`Error sincronizando hospitales: ${error?.message}`);
    }
  }

  private async sincronizarEspecialidades(): Promise<void> {
    try {
      const { data: especialidades } = await firstValueFrom(
        this.httpService.get(`${this.coreUrl}/sync/especialidades`, {
          headers: this.headers,
          timeout: 10000,
        }),
      );

      for (const e of especialidades) {
        await this.prisma.especialidades.upsert({
          where: { id: e.id },
          update: { nombre: e.nombre },
          create: {
            id: e.id,
            nombre: e.nombre,
            descripcion: e.descripcion || null,
          },
        });
      }

      this.logger.log(`Sincronizadas ${especialidades.length} especialidades`);
    } catch (error: any) {
      this.logger.error(`Error sincronizando especialidades: ${error?.message}`);
    }
  }

  async sincronizarUsuario(usuarioId: string): Promise<any> {
    const local = await this.prisma.usuarios.findUnique({
      where: { id: usuarioId },
    });
    if (local) return local;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.coreUrl}/sync/usuarios/${usuarioId}`, {
          headers: this.headers,
          timeout: 5000,
        }),
      );

      return await this.prisma.usuarios.upsert({
        where: { id: usuarioId },
        update: {},
        create: {
          id: data.id,
          nombre: data.nombre,
          apellido: data.apellido,
          email: data.email,
          password_hash: 'SYNCED_FROM_CORE',
          rol: data.rol,
          telefono: data.telefono || null,
          activo: data.activo ?? true,
        },
      });
    } catch (error: any) {
      this.logger.error(`Error sincronizando usuario ${usuarioId}: ${error?.message}`);
      throw new Error(`No se pudo obtener usuario de Core: ${usuarioId}`);
    }
  }

  async sincronizarPaciente(pacienteId: string): Promise<any> {
    const local = await this.prisma.pacientes.findUnique({
      where: { id: pacienteId },
    });
    if (local) return local;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.coreUrl}/sync/pacientes/${pacienteId}`, {
          headers: this.headers,
          timeout: 5000,
        }),
      );

      await this.sincronizarUsuario(data.usuario_id);

      return await this.prisma.pacientes.upsert({
        where: { id: pacienteId },
        update: {},
        create: {
          id: data.id,
          usuario_id: data.usuario_id,
          fecha_nacimiento: data.fecha_nacimiento ? new Date(data.fecha_nacimiento) : null,
          tipo_sangre: data.tipo_sangre || null,
          numero_documento: data.numero_documento || null,
          tipo_documento: data.tipo_documento || 'CC',
          eps: data.eps || null,
          alergias: data.alergias || null,
        },
      });
    } catch (error: any) {
      this.logger.error(`Error sincronizando paciente ${pacienteId}: ${error?.message}`);
      throw new Error(`No se pudo obtener paciente de Core: ${pacienteId}`);
    }
  }

  async buscarPacientePorDocumento(cedula: string): Promise<any> {
    const local = await this.prisma.pacientes.findFirst({
      where: { numero_documento: cedula },
    });
    if (local) return local;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${this.coreUrl}/sync/pacientes/documento/${cedula}`,
          { headers: this.headers, timeout: 5000 },
        ),
      );

      await this.sincronizarUsuario(data.usuario_id);

      return await this.prisma.pacientes.upsert({
        where: { id: data.id },
        update: {},
        create: {
          id: data.id,
          usuario_id: data.usuario_id,
          fecha_nacimiento: data.fecha_nacimiento ? new Date(data.fecha_nacimiento) : null,
          tipo_sangre: data.tipo_sangre || null,
          numero_documento: data.numero_documento || null,
          tipo_documento: data.tipo_documento || 'CC',
          eps: data.eps || null,
          alergias: data.alergias || null,
        },
      });
    } catch (error: any) {
      this.logger.error(`Error buscando paciente por cédula ${cedula}: ${error?.message}`);
      throw new Error(`No se pudo obtener paciente con cédula ${cedula} desde Core`);
    }
  }

  async sincronizarEnfermero(enfermeroId: string): Promise<any> {
    const local = await this.prisma.enfermeros.findUnique({
      where: { id: enfermeroId },
    });
    if (local) return local;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.coreUrl}/sync/enfermeros/${enfermeroId}`, {
          headers: this.headers,
          timeout: 5000,
        }),
      );

      await this.sincronizarUsuario(data.usuario_id);

      if (data.nivel_formacion_id) {
        await this.prisma.formacion.upsert({
          where: { id: data.nivel_formacion_id },
          update: {},
          create: {
            id: data.nivel_formacion_id,
            nombre: data.formacion?.nombre || 'N/A',
          },
        });
      }

      return await this.prisma.enfermeros.upsert({
        where: { id: enfermeroId },
        update: {},
        create: {
          id: data.id,
          usuario_id: data.usuario_id,
          numero_registro: data.numero_registro,
          nivel_formacion_id: data.nivel_formacion_id,
          certificacion_triage: data.certificacion_triage ?? false,
          activo: data.activo ?? true,
        },
      });
    } catch (error: any) {
      this.logger.error(`Error sincronizando enfermero ${enfermeroId}: ${error?.message}`);
      throw new Error(`No se pudo obtener enfermero de Core: ${enfermeroId}`);
    }
  }

  async sincronizarMedico(medicoId: string): Promise<any> {
    const local = await this.prisma.medicos.findUnique({
      where: { id: medicoId },
    });
    if (local) return local;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.coreUrl}/sync/medicos/${medicoId}`, {
          headers: this.headers,
          timeout: 5000,
        }),
      );

      await this.sincronizarUsuario(data.usuario_id);

      return await this.prisma.medicos.upsert({
        where: { id: medicoId },
        update: {},
        create: {
          id: data.id,
          usuario_id: data.usuario_id,
          especialidad_id: data.especialidad_id,
          numero_registro: data.numero_registro,
          consultorio: data.consultorio || null,
          activo: data.activo ?? true,
        },
      });
    } catch (error: any) {
      this.logger.error(`Error sincronizando médico ${medicoId}: ${error?.message}`);
      throw new Error(`No se pudo obtener médico de Core: ${medicoId}`);
    }
  }

    async resolverMedicoIdPorUsuario(usuarioId: string): Promise<string> {
    const local = await this.prisma.medicos.findFirst({
      where: { usuario_id: usuarioId },
      select: { id: true },
    });
    if (local) return local.id;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${this.coreUrl}/sync/medicos/usuario/${usuarioId}`,
          { headers: this.headers, timeout: 5000 },
        ),
      );
      const medico = await this.sincronizarMedico(data.id);
      return medico.id;
    } catch (error: any) {
      throw new Error(`No se pudo resolver médico para usuario ${usuarioId}: ${error?.message}`);
    }
  }
}