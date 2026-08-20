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

export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
  auth: {
    persistSession: false
  },
  realtime: {
    transport: ws
  }
});
