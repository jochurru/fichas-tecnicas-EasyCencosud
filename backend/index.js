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

// Endpoint de depuración seguro para la base de datos
app.get('/api/debug/db', async (req, res) => {
  try {
    const { count, error: countError } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return res.status(500).json({ step: 'conteo', error: countError });
    }

    const { data: sampleProducts, error: sampleError } = await supabase
      .from('productos')
      .select('sku, descripcion')
      .limit(3);

    if (sampleError) {
      return res.status(500).json({ step: 'muestra', error: sampleError });
    }

    const { data: targetProduct, error: targetError } = await supabase
      .from('productos')
      .select('*')
      .eq('sku', '1269208')
      .maybeSingle();

    res.json({
      success: true,
      totalProductos: count,
      muestra: sampleProducts,
      busquedaSierra: targetProduct,
      targetError
    });
  } catch (err) {
    res.status(500).json({ error: 'Excepcion critica', message: err.message });
  }
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

// Crear usuarios por defecto (Administrador y Operador) en el arranque si no existen
const createDefaultUsers = async () => {
  const usersToCreate = [
    {
      email: 'admin@easy.com.ar',
      password: process.env.ADMIN_PASSWORD || 'EasyIT2026!',
      label: 'administrador'
    },
    {
      email: 'usuario@easy.com.ar',
      password: 'UsuarioIT2026!',
      label: 'operador / usuario'
    }
  ];

  for (const userConfig of usersToCreate) {
    try {
      console.log(`[Startup] Verificando usuario ${userConfig.label} (${userConfig.email})...`);
      
      const { data, error } = await supabase.auth.admin.createUser({
        email: userConfig.email,
        password: userConfig.password,
        email_confirm: true
      });

      if (error) {
        if (error.message.includes('already exists') || error.status === 422 || error.message.includes('unique')) {
          console.log(`[Startup] ✓ Usuario ${userConfig.label} ya registrado en Supabase.`);
        } else {
          console.warn(`[Startup] ⚠️ Advertencia al verificar/crear ${userConfig.label}:`, error.message);
        }
      } else {
        console.log(`[Startup] ★ ¡Usuario ${userConfig.label} creado con éxito en Supabase Auth!`);
      }
    } catch (err) {
      console.error(`[Startup] ❌ Error al procesar ${userConfig.label}:`, err.message);
    }
  }
};

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de Fichas Técnicas corriendo en http://localhost:${PORT}`);
  console.log(`- Health Check: http://localhost:${PORT}/health`);
  
  // Ejecutar verificación de administrador y operador
  createDefaultUsers();
});
