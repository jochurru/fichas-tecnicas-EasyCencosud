import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCompleteness, detectInconsistencies } from '../lib/dataQuality.js';

describe('Pruebas Unitarias: dataQuality.js', () => {
  test('calculateCompleteness retorne 0 para objetos vacíos', () => {
    const completeness = calculateCompleteness({}, {});
    assert.equal(completeness, 0);
  });

  test('calculateCompleteness alcance 100% para ficha completa', () => {
    const producto = {
      sku: '123456',
      descripcion: 'Taladro Percutor 500W',
      proveedor: 'BOSCH SA'
    };
    const ficha = {
      ean: '7791234567890',
      foto_url: 'https://ejemplo.com/foto.webp',
      especificaciones_json: {
        marca: 'Bosch',
        especificaciones: [
          { clave: 'Potencia', valor: '500W' },
          { clave: 'Voltaje', valor: '220V' },
          { clave: 'Garantía', valor: '1 Año' }
        ]
      }
    };

    const completeness = calculateCompleteness(producto, ficha);
    assert.equal(completeness, 100);
  });

  test('detectInconsistencies detecte falta de EAN y foto', () => {
    const producto = { sku: '999888', descripcion: 'Amoladora' };
    const ficha = { foto_url: '', especificaciones_json: {} };

    const inconsistencies = detectInconsistencies(producto, ficha, []);
    assert.ok(inconsistencies.length >= 2);
    assert.ok(inconsistencies.some(i => i.tipo === 'EAN_MISSING'));
    assert.ok(inconsistencies.some(i => i.tipo === 'IMAGE_MISSING'));
  });
});
