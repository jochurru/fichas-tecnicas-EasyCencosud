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

const safeUrl = supabaseUrl || 'https://mock.supabase.co';
const safeKey = supabaseKey || 'mock-key';

// Cliente global usado principalmente para autenticación
export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: false
  },
  realtime: {
    transport: ws
  }
});

export const createDbClientWithToken = (token) => {
  return createClient(safeUrl, safeKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
    realtime: { transport: ws }
  });
};

// Cliente dedicado exclusivo para consultas de base de datos.
// Esto evita que mutaciones de headers (provocadas al validar tokens JWT de usuarios de bajos privilegios)
// afecten las consultas del backend y causen problemas de RLS.
export const supabaseDb = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: false
  },
  realtime: {
    transport: ws
  }
});

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || safeKey;
export const supabaseAdmin = createClient(safeUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  },
  realtime: {
    transport: ws
  }
});
