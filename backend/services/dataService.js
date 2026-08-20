import { SupabaseProvider } from './providers/supabaseProvider.js';

// Determinamos el proveedor activo desde variables de entorno.
// Por defecto usaremos 'supabase'.
const DATA_PROVIDER = process.env.DATA_PROVIDER || 'supabase';

let activeProvider;

console.log(`[DataService] Inicializando capa de datos con proveedor: ${DATA_PROVIDER.toUpperCase()}`);

switch (DATA_PROVIDER.toLowerCase()) {
  case 'supabase':
    activeProvider = new SupabaseProvider();
    break;

  case 'cencosud_api':
    // Aquí es donde un programador del departamento de IT de Easy/Cencosud
    // integraría la API real corporativa (ej. VTEX, SAP RFC, o GraphQL de catálogo).
    // Para activarla, solo requerirían crear la clase 'CencosudApiProvider' e importar su lógica.
    // activeProvider = new CencosudApiProvider();
    throw new Error('El proveedor CencosudApiProvider está diseñado para futura integración corporativa.');

  default:
    throw new Error(`Data provider no soportado: ${DATA_PROVIDER}`);
}

export const dataService = activeProvider;
export default dataService;
