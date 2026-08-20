import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import productosRouter from './routes/productos.js';
import impresionRouter from './routes/impresion.js';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Endpoint de salud básico
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Rutas API
app.use('/api', productosRouter);
app.use('/api', impresionRouter);

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de Fichas Técnicas corriendo en http://localhost:${PORT}`);
  console.log(`- Health Check: http://localhost:${PORT}/health`);
});
