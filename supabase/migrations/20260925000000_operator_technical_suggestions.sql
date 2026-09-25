-- Las sugerencias del operador nunca reemplazan la ficha oficial antes de ser aprobadas.
ALTER TABLE public.fichas_tecnicas
  ADD COLUMN IF NOT EXISTS especificaciones_propuestas_json JSONB,
  ADD COLUMN IF NOT EXISTS propuesto_por TEXT,
  ADD COLUMN IF NOT EXISTS propuesto_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estado_previo TEXT;

CREATE INDEX IF NOT EXISTS idx_fichas_pendientes_revision
  ON public.fichas_tecnicas (estado, sector_id)
  WHERE estado = 'PENDIENTE_VALIDACION';

COMMENT ON COLUMN public.fichas_tecnicas.especificaciones_propuestas_json IS
  'Propuesta técnica pendiente. No se utiliza para impresión hasta su aprobación.';
COMMENT ON COLUMN public.fichas_tecnicas.propuesto_por IS
  'Correo del operador que envió la propuesta técnica.';
