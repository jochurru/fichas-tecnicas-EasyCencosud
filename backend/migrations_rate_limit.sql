-- Creación de la tabla de límites de cuota para consultas de IA
CREATE TABLE IF NOT EXISTS gemini_rate_limits (
  email TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Creación de la función atómica (RPC) para incrementar y consultar la cuota
CREATE OR REPLACE FUNCTION increment_gemini_rate_limit(p_email TEXT)
RETURNS TABLE (count INTEGER, reset_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO gemini_rate_limits (email, count, reset_at)
  VALUES (p_email, 1, NOW() + INTERVAL '15 minutes')
  ON CONFLICT (email) DO UPDATE SET
    count = CASE WHEN gemini_rate_limits.reset_at < NOW() THEN 1 ELSE gemini_rate_limits.count + 1 END,
    reset_at = CASE WHEN gemini_rate_limits.reset_at < NOW() THEN NOW() + INTERVAL '15 minutes' ELSE gemini_rate_limits.reset_at END
  RETURNING gemini_rate_limits.count, gemini_rate_limits.reset_at;
END;
$$ LANGUAGE plpgsql;
