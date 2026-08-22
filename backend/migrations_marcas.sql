-- Tabla para almacenar los logotipos y marcas dinámicas
CREATE TABLE IF NOT EXISTS marcas (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL, -- Ej: 'bosch', 'robust', 'daewoo'
    nombre TEXT NOT NULL,      -- Ej: 'BOSCH', 'ROBUST', 'DAEWOO'
    logo_url TEXT NOT NULL,    -- URL pública en Supabase Storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para búsquedas veloces por Slug
CREATE INDEX IF NOT EXISTS idx_marcas_slug ON marcas(slug);
