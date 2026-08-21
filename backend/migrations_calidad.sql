-- Migración de Calidad de Datos P1: Fichas Técnicas Easy Cencosud
-- Correr esta consulta en el Editor SQL de Supabase (https://supabase.com/dashboard)

-- 1. Reglas de Inmutabilidad para Historial de Fichas (P0.6)
-- Evita que cualquier sentencia SQL (por error u operaciones de administrador) borre filas del historial
CREATE OR REPLACE RULE no_delete_fichas_historial AS 
ON DELETE TO fichas_historial DO INSTEAD NOTHING;

-- Evita que se modifiquen los registros históricos existentes
CREATE OR REPLACE RULE no_update_fichas_historial AS 
ON UPDATE TO fichas_historial DO INSTEAD NOTHING;

-- 2. Migrar estados existentes de minúsculas (legacy) a la nomenclatura estandarizada P1.2
-- Mapea 'borrador_ia' -> 'GENERADA_POR_IA' y 'aprobado' -> 'APROBADA'
UPDATE fichas_tecnicas SET estado = 'GENERADA_POR_IA' WHERE estado = 'borrador_ia';
UPDATE fichas_tecnicas SET estado = 'APROBADA' WHERE estado = 'aprobado';

-- Si alguna ficha no tuviera estado seteado, por defecto es BORRADOR
UPDATE fichas_tecnicas SET estado = 'BORRADOR' WHERE estado IS NULL;

-- 3. Restricción de verificación (CHECK CONSTRAINT) para el ciclo de vida de la ficha (P1.2)
ALTER TABLE fichas_tecnicas DROP CONSTRAINT IF EXISTS chk_estado_fichas;

ALTER TABLE fichas_tecnicas ADD CONSTRAINT chk_estado_fichas CHECK (
    estado IN (
        'SIN_FICHA', 
        'BORRADOR', 
        'GENERADA_POR_IA', 
        'PENDIENTE_VALIDACION', 
        'APROBADA', 
        'OBSERVADA', 
        'DESACTUALIZADA', 
        'VENCIDA'
    )
);
