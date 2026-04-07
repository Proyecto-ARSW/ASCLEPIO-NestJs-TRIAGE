import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Niveles de triage
  console.log('📊 Creating niveles_triage...');
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

  // 2. Hospital de prueba
  console.log('🏥 Creating hospital...');
  const hospital = await prisma.hospitales.create({
    data: {
      nombre: 'Hospital Universitario de Desarrollo',
      nit: '900123456-7',
      departamento: 'Cundinamarca',
      ciudad: 'Bogotá',
      direccion: 'Calle 127 # 45-67',
      telefono: '+57 1 234 5678',
      email_contacto: 'contacto@hospital-dev.com',
      tipo_institucion: 'Público',
      capacidad_urgencias: 50,
      numero_consultorios: 20,
      activo: true,
    },
  });

  // 3. Formación
  console.log('🎓 Creating formacion...');
  const formacion = await prisma.formacion.create({
    data: {
      nombre: 'Enfermería Profesional',
      descripcion: 'Título profesional en enfermería',
    },
  });

  // 4. Usuario enfermero
  console.log('👨‍⚕️ Creating enfermero...');
  const usuarioEnfermero = await prisma.usuarios.create({
    data: {
      nombre: 'María',
      apellido: 'Rodríguez',
      email: 'maria.enfermera@hospital-dev.com',
      password_hash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', // 'password123'
      rol: 'ENFERMERO',
      telefono: '+57 300 123 4567',
      activo: true,
    },
  });

  const enfermero = await prisma.enfermeros.create({
    data: {
      usuario_id: usuarioEnfermero.id,
      numero_registro: 'ENF-12345',
      nivel_formacion_id: formacion.id,
      certificacion_triage: true,
      fecha_certificacion: new Date('2023-01-15'),
      activo: true,
    },
  });

  // 5. Usuario paciente
  console.log('🧑 Creating paciente...');
  const usuarioPaciente = await prisma.usuarios.create({
    data: {
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan.perez@example.com',
      password_hash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', // 'password123'
      rol: 'PACIENTE',
      telefono: '+57 310 987 6543',
      activo: true,
    },
  });

  const paciente = await prisma.pacientes.create({
    data: {
      usuario_id: usuarioPaciente.id,
      fecha_nacimiento: new Date('1990-05-15'),
      tipo_sangre: 'O+',
      numero_documento: '1032456789',
      tipo_documento: 'CC',
      eps: 'Compensar',
      alergias: 'Penicilina',
    },
  });

  console.log('\n✅ Seed completed successfully!');
  console.log('═══════════════════════════════════════════════');
  console.log(`🏥 Hospital ID: ${hospital.id}`);
  console.log(`👨‍⚕️ Enfermero ID: ${enfermero.id}`);
  console.log(`   Usuario ID: ${usuarioEnfermero.id}`);
  console.log(`   Email: ${usuarioEnfermero.email}`);
  console.log(`🧑 Paciente ID: ${paciente.id}`);
  console.log(`   Usuario ID: ${usuarioPaciente.id}`);
  console.log(`   Documento: ${paciente.numero_documento}`);
  console.log(`   Email: ${usuarioPaciente.email}`);
  console.log('═══════════════════════════════════════════════');
  console.log('💡 Password para todos los usuarios: password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });