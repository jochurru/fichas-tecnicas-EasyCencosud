export function buildTechnicalSuggestion(officialSpecs = {}, suggestedSpecs = [], now = new Date()) {
  const validationDate = now.toISOString().slice(0, 10);

  return {
    ...officialSpecs,
    especificaciones: suggestedSpecs.map((spec) => ({
      clave: String(spec.clave || '').trim(),
      valor: String(spec.valor || '').trim(),
      origen: 'SUGERENCIA_OPERADOR',
      fecha_validacion: spec.fecha_validacion || validationDate
    }))
  };
}

export function buildSuggestionRejectionUpdate(observaciones, previousState = 'APROBADA') {
  return {
    estado: previousState,
    especificaciones_propuestas_json: null,
    propuesto_por: null,
    propuesto_at: null,
    estado_previo: null,
    observaciones_revision: observaciones.trim(),
    updated_at: new Date().toISOString()
  };
}
