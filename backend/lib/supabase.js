import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'ADVERTENCIA: SUPABASE_URL o SUPABASE_KEY no están configuradas en las variables de entorno. Las consultas a la base de datos fallarán.'
  );
}

// Cliente global usado principalmente para autenticación
export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
  auth: {
    persistSession: false
  },
  realtime: {
    transport: ws
  }
});

// Cliente dedicado exclusivo para consultas de base de datos.
// Esto evita que mutaciones de headers (provocadas al validar tokens JWT de usuarios de bajos privilegios)
// afecten las consultas del backend y causen problemas de RLS.
export const supabaseDb = createClient(supabaseUrl || '', supabaseKey || '', {
  auth: {
    persistSession: false
  },
  realtime: {
    transport: ws
  }
});
