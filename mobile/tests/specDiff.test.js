import test from 'node:test';
import assert from 'node:assert/strict';
import { compareTechnicalSpecs } from '../src/utils/specDiff.js';

test('clasifica especificaciones agregadas, modificadas y eliminadas', () => {
  const result = compareTechnicalSpecs(
    [
      { clave: 'Potencia', valor: '500 W' },
      { clave: 'Voltaje', valor: '220 V' },
      { clave: 'Peso', valor: '2 kg' }
    ],
    [
      { clave: 'Potencia', valor: '600 W' },
      { clave: 'Voltaje', valor: '220 V' },
      { clave: 'Garantia', valor: '2 anos' }
    ]
  );

  assert.deepEqual(result.modified, [{
    type: 'modified', key: 'Potencia', before: '500 W', after: '600 W'
  }]);
  assert.deepEqual(result.added, [{
    type: 'added', key: 'Garantia', before: null, after: '2 anos'
  }]);
  assert.deepEqual(result.removed, [{
    type: 'removed', key: 'Peso', before: '2 kg', after: null
  }]);
  assert.equal(result.unchanged.length, 1);
});

test('compara claves sin distinguir mayusculas ni espacios laterales', () => {
  const result = compareTechnicalSpecs(
    [{ clave: ' Potencia ', valor: '500 W' }],
    [{ clave: 'potencia', valor: '500 W' }]
  );

  assert.equal(result.changes.length, 0);
  assert.equal(result.unchanged.length, 1);
});
