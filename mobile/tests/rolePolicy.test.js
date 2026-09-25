import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canManageRole,
  canResetPasswords,
  getCreatableRoles,
  normalizeRole
} from '../src/utils/rolePolicy.js';

test('la creacion de usuarios respeta la cascada jerarquica', () => {
  assert.deepEqual(getCreatableRoles('jefe_sector'), ['coordinador', 'operador']);
  assert.deepEqual(getCreatableRoles('subadmin'), ['jefe_sector', 'coordinador', 'operador']);
  assert.deepEqual(getCreatableRoles('gerente'), ['subadmin', 'jefe_sector', 'coordinador', 'operador']);
  assert.deepEqual(getCreatableRoles('superadmin'), ['gerente', 'subadmin', 'jefe_sector', 'coordinador', 'operador']);
});

test('solo subadministracion y niveles superiores pueden resetear claves', () => {
  for (const role of ['subadmin', 'admin', 'gerente', 'superadmin']) {
    assert.equal(canResetPasswords(role), true, `${role} deberia poder resetear claves`);
  }
  for (const role of ['jefe_sector', 'coordinador', 'operador']) {
    assert.equal(canResetPasswords(role), false, `${role} no deberia poder resetear claves`);
  }
});

test('solo se pueden administrar roles estrictamente inferiores', () => {
  assert.equal(canManageRole('subadmin', 'jefe_sector'), true);
  assert.equal(canManageRole('subadmin', 'subadmin'), false);
  assert.equal(canManageRole('subadmin', 'gerente'), false);
  assert.equal(canManageRole('gerente', 'subadmin'), true);
  assert.equal(canManageRole('superadmin', 'rol_desconocido'), false);
});

test('los nombres legacy se normalizan sin ampliar privilegios', () => {
  assert.equal(normalizeRole('operator'), 'operador');
  assert.equal(normalizeRole('coordinator'), 'coordinador');
  assert.deepEqual(getCreatableRoles('coordinator'), []);
});
