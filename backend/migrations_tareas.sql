-- Migración: Creación de tabla para persistencia de tareas de importación SAP
CREATE TABLE IF NOT EXISTS tareas_importacion (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'processing',
  processed INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  percentage INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  estadisticas JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
