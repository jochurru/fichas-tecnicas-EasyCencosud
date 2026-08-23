import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loginSchema, searchSchema } from '../middlewares/validation.js';

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
});
