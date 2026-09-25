import test from 'node:test';
import assert from 'node:assert/strict';
import { requireMinRole, requireRoles, ROLE_HIERARCHY } from '../middlewares/authMiddleware.js';
import { getAllowedSectorsForUser, STORE_BLOCKS } from '../config/storeBlocks.js';
import { buildSuggestionRejectionUpdate, buildTechnicalSuggestion } from '../lib/fichaWorkflow.js';
import {
  canCreateRole,
  canEditOfficialFicha,
  canManageImages,
  canManageRole,
  canResetPasswords,
  getCreatableRoles,
  isOperatorRole,
  normalizeRole
} from '../lib/rolePolicy.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('requireRoles rechaza solicitudes sin usuario autenticado', () => {
  const res = createResponse();
  let nextCalled = false;

  requireRoles(['gerente'])({}, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireRoles permite roles declarados y mantiene el bypass de superadmin', () => {
  for (const role of ['coordinador', 'superadmin']) {
    const res = createResponse();
    let nextCalled = false;

    requireRoles(['coordinador'])({ user: { role } }, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true, `El rol ${role} debia continuar`);
    assert.equal(res.statusCode, 200);
  }
});

test('requireRoles rechaza un rol autenticado sin permiso', () => {
  const res = createResponse();
  let nextCalled = false;

  requireRoles(['gerente'])({ user: { role: 'operador' } }, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test('la jerarquia de roles conserva el orden de privilegios esperado', () => {
  assert.ok(ROLE_HIERARCHY.superadmin > ROLE_HIERARCHY.gerente);
  assert.ok(ROLE_HIERARCHY.gerente > ROLE_HIERARCHY.subadmin);
  assert.ok(ROLE_HIERARCHY.subadmin > ROLE_HIERARCHY.jefe_sector);
  assert.ok(ROLE_HIERARCHY.jefe_sector > ROLE_HIERARCHY.coordinador);
  assert.ok(ROLE_HIERARCHY.coordinador > ROLE_HIERARCHY.operador);
});

test('requireMinRole aplica el nivel minimo', () => {
  const allowedRes = createResponse();
  const deniedRes = createResponse();
  let allowed = false;
  let denied = false;

  requireMinRole('jefe_sector')(
    { user: { role: 'subadmin' } },
    allowedRes,
    () => { allowed = true; }
  );
  requireMinRole('jefe_sector')(
    { user: { role: 'operador' } },
    deniedRes,
    () => { denied = true; }
  );

  assert.equal(allowed, true);
  assert.equal(denied, false);
  assert.equal(deniedRes.statusCode, 403);
});

test('gerencia obtiene todos los sectores configurados', () => {
  const expected = STORE_BLOCKS.flatMap((block) => block.sector_ids);
  assert.deepEqual(
    getAllowedSectorsForUser({ role: 'gerente', email: 'gerencia@easy.com.ar' }),
    expected
  );
});

test('jefe y coordinador resuelven solamente su bloque configurado', () => {
  const jefeBlock = STORE_BLOCKS[1];
  const coordinatorBlock = STORE_BLOCKS[2];

  assert.deepEqual(
    getAllowedSectorsForUser({ role: 'jefe_sector', email: jefeBlock.jefe_email }),
    jefeBlock.sector_ids
  );
  assert.deepEqual(
    getAllowedSectorsForUser({ role: 'coordinador', bloque_id: coordinatorBlock.id }),
    coordinatorBlock.sector_ids
  );
});

test('el operador no puede administrar imagenes ni editar la ficha oficial', () => {
  for (const role of ['operador', 'operator']) {
    assert.equal(isOperatorRole(role), true);
    assert.equal(canManageImages(role), false);
    assert.equal(canEditOfficialFicha(role), false);
  }

  assert.equal(canManageImages('coordinador'), true);
  assert.equal(canEditOfficialFicha('coordinador'), true);
});

test('la sugerencia tecnica conserva marca y tipo oficiales', () => {
  const official = {
    marca: 'ROBUST',
    tipo_herramienta: 'Taladro',
    sugerencia_busqueda_imagen: 'foto oficial',
    especificaciones: [{ clave: 'Potencia', valor: '500 W' }]
  };

  const proposal = buildTechnicalSuggestion(
    official,
    [{ clave: 'Potencia', valor: '650 W' }, { clave: 'Uso', valor: 'Profesional' }],
    new Date('2026-09-25T12:00:00Z')
  );

  assert.equal(proposal.marca, 'ROBUST');
  assert.equal(proposal.tipo_herramienta, 'Taladro');
  assert.equal(proposal.sugerencia_busqueda_imagen, 'foto oficial');
  assert.deepEqual(proposal.especificaciones, [
    { clave: 'Potencia', valor: '650 W', origen: 'SUGERENCIA_OPERADOR', fecha_validacion: '2026-09-25' },
    { clave: 'Uso', valor: 'Profesional', origen: 'SUGERENCIA_OPERADOR', fecha_validacion: '2026-09-25' }
  ]);
});

test('rechazar una sugerencia no genera cambios sobre foto, logo, EAN ni plantilla', () => {
  const update = buildSuggestionRejectionUpdate('Dato no verificable', 'APROBADA');

  assert.equal(update.estado, 'APROBADA');
  assert.equal(update.especificaciones_propuestas_json, null);
  assert.equal('foto_url' in update, false);
  assert.equal('template_preferido' in update, false);
  assert.equal('eans' in update, false);
  assert.equal('logo_url' in update, false);
});

test('la creacion de usuarios respeta la cascada jerarquica', () => {
  assert.deepEqual(getCreatableRoles('jefe_sector'), ['coordinador', 'operador']);
  assert.deepEqual(getCreatableRoles('subadmin'), ['jefe_sector', 'coordinador', 'operador']);
  assert.deepEqual(getCreatableRoles('gerente'), ['subadmin', 'jefe_sector', 'coordinador', 'operador']);
  assert.deepEqual(getCreatableRoles('superadmin'), ['gerente', 'subadmin', 'jefe_sector', 'coordinador', 'operador']);

  assert.equal(canCreateRole('subadmin', 'gerente'), false);
  assert.equal(canCreateRole('subadmin', 'subadmin'), false);
  assert.equal(canCreateRole('subadmin', 'jefe_sector'), true);
});

test('solo subadministracion y niveles superiores pueden resetear claves inferiores', () => {
  for (const role of ['subadmin', 'admin', 'gerente', 'superadmin']) {
    assert.equal(canResetPasswords(role), true);
  }
  for (const role of ['jefe_sector', 'coordinador', 'operador']) {
    assert.equal(canResetPasswords(role), false);
  }

  assert.equal(canManageRole('subadmin', 'jefe_sector'), true);
  assert.equal(canManageRole('subadmin', 'subadmin'), false);
  assert.equal(canManageRole('subadmin', 'gerente'), false);
  assert.equal(canManageRole('superadmin', 'rol_desconocido'), false);
});

test('los roles legacy se normalizan sin ampliar permisos', () => {
  assert.equal(normalizeRole('operator'), 'operador');
  assert.equal(normalizeRole('coordinator'), 'coordinador');
  assert.equal(canCreateRole('coordinator', 'operador'), false);
});

test.todo('P0: una cuenta con activo=false debe ser rechazada por requireAuth');
test.todo('P0: un coordinador no puede consultar, aprobar ni rechazar fichas de otro sector');
