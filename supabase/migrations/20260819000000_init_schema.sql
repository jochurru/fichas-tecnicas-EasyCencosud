-- Migration: 20260819000000_init_schema.sql
-- Description: Inicialización del esquema de base de datos para Fichas Técnicas Easy

-- Habilitar extensión pgcrypto si no está habilitada (para gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Catálogo Maestro de Productos (Desde reporte SAP)
CREATE TABLE productos (
    sku VARCHAR(50) PRIMARY KEY,                  -- 'Material' de SAP (ej: '148135')
    descripcion VARCHAR(255) NOT NULL,            -- 'Texto breve de material'
    proveedor VARCHAR(255) DEFAULT 'DESCONOCIDO', -- 'Razón Social'
    grupo_compras VARCHAR(10) NOT NULL,           -- 'Grupo de compras' (ej: '45')
    grupo_articulos VARCHAR(50),                  -- 'Grupo de artículos' (ej: '450608001')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Códigos de Barras asociados (Relación 1 a N)
CREATE TABLE codigos_ean (
    ean VARCHAR(13) PRIMARY KEY,                  -- Código EAN-13
    sku VARCHAR(50) NOT NULL REFERENCES productos(sku) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Fichas Técnicas Dinámicas
CREATE TABLE fichas_tecnicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) NOT NULL REFERENCES productos(sku) ON DELETE CASCADE UNIQUE, -- Relación 1:1 lógica
    foto_url TEXT,
    especificaciones_json JSONB NOT NULL DEFAULT '{}'::jsonb, -- Atributos dinámicos clave-valor
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador_ia',        -- 'borrador_ia', 'aprobado', 'rechazado'
    template_preferido INT DEFAULT 1,                         -- 1, 2 o 3
    aprobado_por VARCHAR(100),
    aprobado_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimización de búsquedas y uniones
CREATE INDEX idx_codigos_ean_sku ON codigos_ean(sku);
CREATE INDEX idx_fichas_sku ON fichas_tecnicas(sku);
CREATE INDEX idx_fichas_tecnicas_estado ON fichas_tecnicas(estado);

-- Trigger para actualizar updated_at automáticamente en fichas_tecnicas
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_fichas_tecnicas_updated_at
    BEFORE UPDATE ON fichas_tecnicas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
