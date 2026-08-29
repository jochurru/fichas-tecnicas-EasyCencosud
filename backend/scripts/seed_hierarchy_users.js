import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas en .env');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

const DEMO_USERS = [
  {
    email: 'martin.reffle@easy.com.ar',
    nombre: 'Martín Reffle',
    rol: 'gerente',
    sector_id: 1,
    must_change_password: true
  },
  {
    email: 'diego.sassano@easy.com.ar',
    nombre: 'Diego Sassano',
    rol: 'subadmin',
    sector_id: 1,
    must_change_password: true
  },
  {
    email: 'hernan.rodriguez@easy.com.ar',
    nombre: 'Hernán Rodríguez',
    rol: 'subadmin',
    sector_id: 1,
    must_change_password: true
  },
  {
    email: 'maximiliano.lobo@easy.com.ar',
    nombre: 'Maximiliano Lobo',
    rol: 'jefe_sector',
    sector_id: 1,
    must_change_password: true
  },
  {
    email: 'coordinador.herramientas@easy.com.ar',
    nombre: 'Coordinador de Herramientas',
    rol: 'coordinador',
    sector_id: 1,
    must_change_password: true
  },
  {
    email: 'vendedor.herramientas@easy.com.ar',
    nombre: 'Vendedor de Salón (Herramientas)',
    rol: 'operador',
    sector_id: 1,
    must_change_password: true
  }
];

const DEFAULT_PASS = 'Easy2026!';

async function seedHierarchyUsers() {
  console.log('=== INICIANDO CREACIÓN DE USUARIOS JERÁRQUICOS EN SUPABASE ===\n');

  for (const u of DEMO_USERS) {
    try {
      // 1. Crear usuario en Supabase Auth o verificar si ya existe
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: DEFAULT_PASS,
        email_confirm: true,
        user_metadata: { nombre: u.nombre, rol: u.rol }
      });

      let userId = authData?.user?.id;

      if (authErr) {
        if (authErr.message.includes('already registered') || authErr.status === 422) {
          console.log(`[EXISTENTE] ${u.email} ya existe en Supabase Auth. Obteniendo ID...`);
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
          const found = usersList?.users?.find(x => x.email === u.email);
          userId = found?.id;
        } else {
          console.error(`[ERROR AUTH] ${u.email}:`, authErr.message);
          continue;
        }
      }

      if (!userId) {
        console.error(`[ERROR] No se pudo obtener UUID para ${u.email}`);
        continue;
      }

      // Resetear la contraseña a la contraseña por defecto Easy2026!
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: DEFAULT_PASS });

      // 2. Insertar/Actualizar perfil en la tabla profiles
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email: u.email,
          nombre: u.nombre,
          rol: u.rol,
          sector_id: u.sector_id,
          must_change_password: u.must_change_password,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (profileErr) {
        console.error(`[ERROR PROFILE] ${u.email}:`, profileErr.message);
      } else {
        console.log(`✅ [OK] ${u.email} (${u.nombre}) -> Rol: ${u.rol.toUpperCase()} (Clave: ${DEFAULT_PASS})`);
      }
    } catch (err) {
      console.error(`[EXCEPCIÓN] ${u.email}:`, err.message);
    }
  }

  console.log('\n=== PROCESO FINALIZADO CON ÉXITO ===');
}

seedHierarchyUsers();
