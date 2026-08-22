-- Migración: Creación de la tabla de roles de usuario
CREATE TABLE IF NOT EXISTS usuarios_roles (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'coordinator', 'operator')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed inicial con el administrador
INSERT INTO usuarios_roles (email, role) VALUES ('admin@easy.com.ar', 'admin')
ON CONFLICT (email) DO NOTHING;
