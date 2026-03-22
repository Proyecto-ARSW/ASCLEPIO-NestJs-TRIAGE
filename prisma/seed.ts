import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  console.log('Creando niveles de triage...');
  await prisma.niveles_triage.createMany({
    data: [
      {
        nivel: 1,
        nombre: 'Resucitación',
        descripcion:
          'Condición que amenaza la vida de manera inmediata. Requiere intervención simultánea de evaluación y tratamiento.',
        tiempo_max_espera_min: 0,
        color_codigo: '#FF0000',
        activo: true,
      },
      {
        nivel: 2,
        nombre: 'Emergencia',
        descripcion:
          'Situación de riesgo vital que requiere atención médica inmediata. Puede evolucionar a deterioro rápido.',
        tiempo_max_espera_min: 15,
        color_codigo: '#FF6600',
        activo: true,
      },
      {
        nivel: 3,
        nombre: 'Urgencia',
        descripcion:
          'Condición que requiere medidas diagnósticas y terapéuticas en urgencias pero no representa riesgo vital inmediato.',
        tiempo_max_espera_min: 60,
        color_codigo: '#FFFF00',
        activo: true,
      },
      {
        nivel: 4,
        nombre: 'Urgencia menor',
        descripcion:
          'Condición que no compromete el estado general del paciente. Puede ser atendido en consulta externa.',
        tiempo_max_espera_min: 120,
        color_codigo: '#00FF00',
        activo: true,
      },
      {
        nivel: 5,
        nombre: 'No urgente',
        descripcion:
          'Problemas de salud crónicos o agudos sin evidencia de deterioro que pueden esperar atención programada.',
        tiempo_max_espera_min: 240,
        color_codigo: '#0000FF',
        activo: true,
      },
    ],
    skipDuplicates: true,
  });
  console.log('Creando niveles de formación...');
  await prisma.formacion.createMany({
    data: [
      {
        nombre: 'Auxiliar',
        descripcion:
          'Formación técnica de 1-2 años. Realiza cuidados básicos bajo supervisión. No autorizado para triage autónomo.',
      },
      {
        nombre: 'Técnico',
        descripcion:
          'Formación tecnológica de 2-3 años. Cuidados de mediana complejidad. Puede realizar triage con supervisión.',
      },
      {
        nombre: 'Profesional',
        descripcion:
          'Pregrado universitario de 4-5 años. Ejercicio autónomo. Autorizado para triage según Resolución 5596/2015.',
      },
      {
        nombre: 'Especialista',
        descripcion:
          'Postgrado en área específica. Formación avanzada en Urgencias, UCI, Pediatría u otras especialidades.',
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seed completado!');
}

main()
  .catch(e => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });