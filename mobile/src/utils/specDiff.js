function normalizeKey(value) {
  return String(value || '').trim().toLocaleLowerCase('es');
}

function normalizeValue(value) {
  return String(value ?? '').trim();
}

export function getTechnicalSpecs(specData) {
  return Array.isArray(specData?.especificaciones) ? specData.especificaciones : [];
}

export function compareTechnicalSpecs(officialSpecs = [], proposedSpecs = []) {
  const officialByKey = new Map();

  officialSpecs.forEach((spec) => {
    const key = normalizeKey(spec?.clave);
    const matches = officialByKey.get(key) || [];
    matches.push(spec);
    officialByKey.set(key, matches);
  });

  const changes = [];
  const unchanged = [];

  proposedSpecs.forEach((proposed) => {
    const normalizedKey = normalizeKey(proposed?.clave);
    const matches = officialByKey.get(normalizedKey) || [];
    const official = matches.shift();

    if (matches.length === 0) officialByKey.delete(normalizedKey);
    else officialByKey.set(normalizedKey, matches);

    if (!official) {
      changes.push({
        type: 'added',
        key: proposed?.clave || 'Sin nombre',
        before: null,
        after: normalizeValue(proposed?.valor)
      });
      return;
    }

    const before = normalizeValue(official.valor);
    const after = normalizeValue(proposed?.valor);
    const comparison = {
      type: before === after ? 'unchanged' : 'modified',
      key: proposed?.clave || official.clave || 'Sin nombre',
      before,
      after
    };

    if (comparison.type === 'unchanged') unchanged.push(comparison);
    else changes.push(comparison);
  });

  officialByKey.forEach((specs) => {
    specs.forEach((official) => {
      changes.push({
        type: 'removed',
        key: official?.clave || 'Sin nombre',
        before: normalizeValue(official?.valor),
        after: null
      });
    });
  });

  return {
    changes,
    unchanged,
    added: changes.filter((change) => change.type === 'added'),
    modified: changes.filter((change) => change.type === 'modified'),
    removed: changes.filter((change) => change.type === 'removed')
  };
}
