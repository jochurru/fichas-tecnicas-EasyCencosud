-- 003_jerarquia_roles.sql
-- Migración aditiva para la gestión de jerarquías, sectores y aprobaciones en Cencosud Easy

-- 1. Tabla de sectores (Categorías/Departamentos de la tienda)
CREATE TABLE IF NOT EXISTS sectores (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    codigo TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO sectores (id, nombre, codigo) 
VALUES (1, 'HERRAMIENTAS', 'HERR') 
ON CONFLICT (id) DO NOTHING;

-- 2. Crear tabla de perfiles de usuario (profiles) vinculada a auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'operador' CHECK (rol IN ('gerente', 'subadmin', 'jefe_sector', 'coordinador', 'operador')),
    sector_id INT REFERENCES sectores(id) DEFAULT 1,
    must_change_password BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE sectores TO anon, authenticated, service_role;

-- 3. Extender fichas_tecnicas con estados de aprobación y ruteo (sin alterar fichas activas)
ALTER TABLE IF EXISTS fichas_tecnicas 
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'aprobado' CHECK (estado IN ('generada_ia', 'pendiente_revision', 'aprobado', 'rechazado')),
ADD COLUMN IF NOT EXISTS sector_id INT REFERENCES sectores(id) DEFAULT 1,
ADD COLUMN IF NOT EXISTS creado_por UUID,
ADD COLUMN IF NOT EXISTS aprobado_por UUID,
ADD COLUMN IF NOT EXISTS observaciones_revision TEXT;
