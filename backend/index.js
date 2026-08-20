import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import productosRouter from './routes/productos.js';
import impresionRouter from './routes/impresion.js';
import catalogosRouter from './routes/catalogos.js';
import { supabase } from './lib/supabase.js';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Endpoint de salud básico
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Endpoint de depuración seguro para variables de entorno
app.get('/api/debug/env', (req, res) => {
  const sanitize = (val) => {
    if (!val) return 'no configurado';
    if (val.length <= 12) return 'configurado (corto)';
    return `${val.substring(0, 8)}...${val.substring(val.length - 4)}`;
  };
  res.json({
    SUPABASE_URL: sanitize(process.env.SUPABASE_URL),
    SUPABASE_KEY: sanitize(process.env.SUPABASE_KEY),
    GEMINI_API_KEY: sanitize(process.env.GEMINI_API_KEY),
    GROQ_API_KEY: sanitize(process.env.GROQ_API_KEY),
    DATA_PROVIDER: process.env.DATA_PROVIDER || 'supabase'
  });
});

// Rutas API
app.use('/api', productosRouter);
app.use('/api', impresionRouter);
app.use('/api', catalogosRouter);

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Crear usuario administrador por defecto en el arranque si no existe
const createDefaultAdmin = async () => {
  try {
    const email = 'admin@easy.com.ar';
    const password = process.env.ADMIN_PASSWORD || 'EasyIT2026!';

    console.log(`[Startup] Verificando usuario administrador por defecto (${email})...`);
    
    // Intentar crear el usuario mediante la API de administración de Supabase
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) {
      // Si el usuario ya existe en Supabase Auth, simplemente lo informamos (es lo esperado)
      if (error.message.includes('already exists') || error.status === 422 || error.message.includes('unique')) {
        console.log('[Startup] ✓ Usuario administrador ya registrado en Supabase.');
      } else {
        console.warn('[Startup] ⚠️ Advertencia al verificar/crear administrador:', error.message);
      }
    } else {
      console.log('[Startup] ★ ¡Usuario administrador creado con éxito en Supabase Auth!');
    }
  } catch (err) {
    console.error('[Startup] ❌ Error en la creación del administrador:', err.message);
  }
};

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de Fichas Técnicas corriendo en http://localhost:${PORT}`);
  console.log(`- Health Check: http://localhost:${PORT}/health`);
  
  // Ejecutar verificación de administrador
  createDefaultAdmin();
});
