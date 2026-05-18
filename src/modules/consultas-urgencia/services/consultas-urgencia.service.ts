import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class ConsultasUrgenciaService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPaciente(
    pacienteId: string,
    page: number,
    limit: number,
  ): Promise<{ data: object[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    const [consultas, total] = await Promise.all([
      this.prisma.consultas_urgencia.findMany({
        where: { paciente_id: pacienteId },
        include: { medicos: true },
        orderBy: { creado_en: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.consultas_urgencia.count({
        where: { paciente_id: pacienteId },
      }),
    ]);

    const medicoUserIds = [
      ...new Set(consultas.map((c) => c.medicos.usuario_id)),
    ];

    const usuarios =
      medicoUserIds.length > 0
        ? await this.prisma.usuarios.findMany({
            where: { id: { in: medicoUserIds } },
            select: { id: true, nombre: true, apellido: true },
          })
        : [];

    const userMap = new Map(usuarios.map((u) => [u.id, u]));

    const data = consultas.map((c) => {
      const usuario = userMap.get(c.medicos.usuario_id);
      const medicoNombre = usuario
        ? `Dr. ${usuario.nombre} ${usuario.apellido}`
        : 'Médico desconocido';
      return {
        id: c.id,
        turno_id: c.turno_id,
        diagnostico: c.diagnostico,
        tratamiento: c.tratamiento,
        observaciones: c.observaciones,
        medico_nombre: medicoNombre,
        nivel_triage: c.nivel_triage,
        creado_en: c.creado_en,
      };
    });

    return { data, total, page, limit };
  }
}