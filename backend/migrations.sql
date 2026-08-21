-- Migración de Seguridad P0: Fichas Técnicas Easy Cencosud
-- Correr esta consulta en el Editor SQL de Supabase (https://supabase.com/dashboard)

-- 1. Tabla de Logs de Auditoría Inmutables
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usuario_email VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL,
    tienda_id VARCHAR(50),
    accion VARCHAR(50) NOT NULL, -- LOGIN, LOGIN_FAILED, PRODUCT_SEARCH, PRODUCT_EDIT, PRODUCT_APPROVE, PHOTO_UPLOAD, SAP_IMPORT_START, SAP_IMPORT_COMPLETE, AI_DRAFT_CREATED, AI_DRAFT_APPROVED, PDF_GENERATED, PRINT_REQUESTED
    entidad VARCHAR(50) NOT NULL,
    sku VARCHAR(50),
    valores_anteriores JSONB,
    valores_nuevos JSONB,
    resultado VARCHAR(20) NOT NULL, -- 'SUCCESS', 'FAILURE', 'ERROR'
    ip_origen VARCHAR(45),
    correlation_id UUID
);

-- Índices para optimizar consultas de monitoreo
CREATE INDEX IF NOT EXISTS idx_audit_sku ON audit_logs(sku);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);

-- 2. Tabla de Historial de Versiones de Fichas Técnicas
CREATE TABLE IF NOT EXISTS fichas_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) NOT NULL REFERENCES productos(sku) ON DELETE CASCADE,
    version INT NOT NULL,
    especificaciones_json JSONB NOT NULL,
    foto_url TEXT,
    origen_cambio VARCHAR(50) NOT NULL, -- 'SAP', 'IA_DRAFT', 'EDICION_LOCAL', 'APROBACION_COORDINADOR'
    modificado_por VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de consulta rápida por SKU y versión
CREATE INDEX IF NOT EXISTS idx_historial_sku_version ON fichas_historial(sku, version);
