'use strict';
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('[seed-catalog] Seeding niveles_triage...');
  await prisma.niveles_triage.createMany({
    data: [
      {
        nivel: 1,
        nombre: 'Resucitación',
        descripcion: 'Riesgo vital inmediato',
        tiempo_max_espera_min: 0,
        color_codigo: '#FF0000',
        activo: true,
      },
      {
        nivel: 2,
        nombre: 'Emergencia',
        descripcion: 'Riesgo vital potencial',
        tiempo_max_espera_min: 15,
        color_codigo: '#FF6600',
        activo: true,
      },
      {
        nivel: 3,
        nombre: 'Urgencia',
        descripcion: 'Situación urgente',
        tiempo_max_espera_min: 60,
        color_codigo: '#FFEB3B',
        activo: true,
      },
      {
        nivel: 4,
        nombre: 'Urgencia menor',
        descripcion: 'Situación no urgente',
        tiempo_max_espera_min: 120,
        color_codigo: '#4CAF50',
        activo: true,
      },
      {
        nivel: 5,
        nombre: 'No urgente',
        descripcion: 'Consulta ambulatoria',
        tiempo_max_espera_min: 240,
        color_codigo: '#2196F3',
        activo: true,
      },
    ],
    skipDuplicates: true,
  });
  console.log('[seed-catalog] niveles_triage OK.');
}

main()
  .catch((e) => {
    console.error('[seed-catalog] Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());