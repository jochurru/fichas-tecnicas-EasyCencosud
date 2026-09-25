import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createUserSchema, loginSchema, searchSchema, excelUploadSchema, suggestFichaSchema } from '../middlewares/validation.js';

describe('Pruebas Unitarias: validation.js (Zod Schemas)', () => {
  describe('loginSchema', () => {
    test('acepte emails institucionales válidos', () => {
      const validAdmin = { email: 'admin@easy.com.ar', password: 'Password123!' };
      const validCenco = { email: 'juan.perez@cencosud.com.ar', password: 'Password123!' };

      assert.doesNotThrow(() => loginSchema.parse(validAdmin));
      assert.doesNotThrow(() => loginSchema.parse(validCenco));
    });

    test('rechace dominios no institucionales', () => {
      const invalidEmail = { email: 'hacker@gmail.com', password: 'Password123!' };
      assert.throws(() => loginSchema.parse(invalidEmail), /institucional/);
    });

    test('rechace contraseñas cortas', () => {
      const shortPass = { email: 'admin@easy.com.ar', password: '123' };
      assert.throws(() => loginSchema.parse(shortPass), /6 caracteres/);
    });
  });

  describe('searchSchema', () => {
    test('acepte SKUs numéricos y alfanuméricos válidos', () => {
      assert.doesNotThrow(() => searchSchema.parse({ identificador: '123456' }));
      assert.doesNotThrow(() => searchSchema.parse({ identificador: 'SKU-ABC-12' }));
    });

    test('rechace caracteres inyectables o especiales', () => {
      assert.throws(() => searchSchema.parse({ identificador: "123' OR 1=1--" }));
      assert.throws(() => searchSchema.parse({ identificador: '<script>' }));
    });
  });

  describe('excelUploadSchema', () => {
    test('acepte base64 con prefijo Data URL de navegador', () => {
      // Cabecera ZIP en base64 = 'UEsDBBQ...'
      const validZipBase64 = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEsDBBQAAAAIAAA=';
      assert.doesNotThrow(() => excelUploadSchema.parse({ fileBase64: validZipBase64 }));
    });
  });

  describe('suggestFichaSchema', () => {
    test('acepte solamente SKU y especificaciones tecnicas', () => {
      const parsed = suggestFichaSchema.parse({
        sku: '1450167',
        especificaciones: [{ clave: 'Potencia', valor: '650 W' }]
      });

      assert.equal(parsed.sku, '1450167');
      assert.equal(parsed.especificaciones.length, 1);
    });

    test('elimine campos protegidos enviados por un operador', () => {
      const parsed = suggestFichaSchema.parse({
        sku: '1450167',
        especificaciones: [{ clave: 'Potencia', valor: '650 W' }],
        foto_url: 'https://attacker.example/foto.webp',
        eans: ['123'],
        template_preferido: 3,
        estado: 'APROBADA'
      });

      assert.deepEqual(Object.keys(parsed).sort(), ['especificaciones', 'sku']);
    });
  });

  describe('createUserSchema', () => {
    const baseUser = {
      email: 'nuevo.usuario@easy.com.ar',
      nombre: 'Nuevo Usuario',
      sector_id: 1
    };

    test('acepte solamente roles asignables dentro de la cascada', () => {
      for (const rol of ['gerente', 'subadmin', 'jefe_sector', 'coordinador', 'operador']) {
        assert.doesNotThrow(() => createUserSchema.parse({ ...baseUser, rol }));
      }
    });

    test('rechace roles de sistema o desconocidos', () => {
      for (const rol of ['superadmin', 'admin', 'owner']) {
        assert.throws(() => createUserSchema.parse({ ...baseUser, rol }));
      }
    });
  });
});
