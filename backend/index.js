import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import productosRouter from './routes/productos.js';
import impresionRouter from './routes/impresion.js';
import catalogosRouter from './routes/catalogos.js';
import storageRouter from './routes/storage.js';
import { supabase, supabaseDb, supabaseAdmin } from './lib/supabase.js';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar Rate Limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // Límite de 300 peticiones por IP cada 15 minutos
  message: {
    error: 'Too Many Requests',
    message: 'Límite de solicitudes excedido para tu dirección IP. Por favor, intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15, // Límite estricto de 15 intentos de login por IP cada 15 minutos (evita fuerza bruta)
  message: {
    error: 'Too Many Requests',
    message: 'Demasiados intentos de inicio de sesión desde esta IP. Por favor, intenta de nuevo después de 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const pdfLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 300, // Límite amplio para evitar bloqueos durante demostraciones intensivas
  message: {
    error: 'Too Many Requests',
    message: 'Has excedido el límite de generación de PDFs. Por favor, espera unos minutos antes de intentar de nuevo.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middlewares de seguridad y parsing
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Permite cargas de recursos cruzados entre Firebase y Cloud Run
}));
const allowedOrigins = [
  'https://easy-fichas-tecnicas.web.app',
  'https://fichastecnicas-abdb5.web.app'
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173');
}
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Aplicar Rate Limiters a rutas críticas antes de cargar las rutas de negocio
app.use('/api/auth/login', authLimiter);
app.use('/api/fichas/imprimir', pdfLimiter);
app.use('/api/fichas/imprimir-lote', pdfLimiter);
app.use('/api/', generalLimiter);

// Endpoint de salud básico
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

import superadminRouter from './routes/superadmin.js';
import usuariosRouter from './routes/usuarios.js';
import aprobacionesRouter from './routes/aprobaciones.js';
import gerenciaRouter from './routes/gerencia.js';

// Rutas API
app.use('/api', productosRouter);
app.use('/api', impresionRouter);
app.use('/api', catalogosRouter);
app.use('/api', storageRouter);
app.use('/api', superadminRouter);
app.use('/api', usuariosRouter);
app.use('/api', aprobacionesRouter);
app.use('/api', gerenciaRouter);

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'Ha ocurrido un error interno.'
  });
});

// Crear usuarios por defecto (Administrador, Coordinador y Operador) en el arranque si no existen
// SOLO si las variables de entorno son provistas. Ya no existen fallbacks hardcodeados en código público.
const createDefaultUsers = async () => {
  const usersToCreate = [];
  
  if (process.env.ADMIN_PASSWORD) {
    usersToCreate.push({ email: 'admin@easy.com.ar', password: process.env.ADMIN_PASSWORD, label: 'administrador' });
  }
  if (process.env.COORD_PASSWORD) {
    usersToCreate.push({ email: 'coordinador@easy.com.ar', password: process.env.COORD_PASSWORD, label: 'coordinador de carteleria' });
  }
  if (process.env.USER_PASSWORD) {
    usersToCreate.push({ email: 'usuario@easy.com.ar', password: process.env.USER_PASSWORD, label: 'operador / usuario' });
  }

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

// Asegurar que los buckets públicos existen en Supabase Storage
const initializeStorageBucket = async () => {
  try {
    console.log('[Startup] Verificando existencia de buckets de almacenamiento con privilegios de administrador...');
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.warn('[Startup] ⚠️ No se pudo listar los buckets de Supabase:', listError.message);
      return;
    }

    // 1. Verificar 'fichas-pdf'
    const pdfExists = buckets.some(b => b.name === 'fichas-pdf');
    if (!pdfExists) {
      console.log('[Startup] El bucket "fichas-pdf" no existe. Creándolo...');
      const { error: createError } = await supabaseAdmin.storage.createBucket('fichas-pdf', {
        public: true,
        fileSizeLimit: 1024 * 1024 * 5, // Límite de 5MB
        allowedMimeTypes: ['application/pdf']
      });
      if (createError) {
        console.error('[Startup] ❌ Error al crear el bucket "fichas-pdf":', createError.message);
      } else {
        console.log('[Startup] ★ Bucket "fichas-pdf" creado con éxito.');
      }
    } else {
      const { error: updateError } = await supabaseAdmin.storage.updateBucket('fichas-pdf', { public: true });
      if (updateError) {
        console.warn('[Startup] ⚠️ No se pudo forzar visibilidad pública en "fichas-pdf":', updateError.message);
      } else {
        console.log('[Startup] ✓ Bucket "fichas-pdf" verificado y asegurado como público.');
      }
    }

    // 2. Verificar 'imagenes-catalogo'
    const imgExists = buckets.some(b => b.name === 'imagenes-catalogo');
    if (!imgExists) {
      console.log('[Startup] El bucket "imagenes-catalogo" no existe. Creándolo...');
      const { error: createError } = await supabaseAdmin.storage.createBucket('imagenes-catalogo', {
        public: true,
        fileSizeLimit: 1024 * 1024 * 10, // Límite de 10MB
        allowedMimeTypes: ['image/webp', 'image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
      });
      if (createError) {
        console.error('[Startup] ❌ Error al crear el bucket "imagenes-catalogo":', createError.message);
      } else {
        console.log('[Startup] ★ Bucket "imagenes-catalogo" creado con éxito.');
      }
    } else {
      const { error: updateError } = await supabaseAdmin.storage.updateBucket('imagenes-catalogo', { public: true });
      if (updateError) {
        console.warn('[Startup] ⚠️ No se pudo forzar visibilidad pública en "imagenes-catalogo":', updateError.message);
      } else {
        console.log('[Startup] ✓ Bucket "imagenes-catalogo" verificado y asegurado como público.');
      }
    }
  } catch (err) {
    console.error('[Startup] ❌ Error al inicializar almacenamiento:', err.message);
  }
};

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de Fichas Técnicas corriendo en http://localhost:${PORT}`);
  console.log(`- Health Check: http://localhost:${PORT}/health`);
  
  // Ejecutar verificación de administrador, operador y almacenamiento
  createDefaultUsers();
  initializeStorageBucket();
});
