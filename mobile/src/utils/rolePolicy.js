const ROLE_ALIASES = Object.freeze({
  operator: 'operador',
  coordinator: 'coordinador'
});

export const ROLE_LEVELS = Object.freeze({
  operador: 1,
  coordinador: 2,
  jefe_sector: 3,
  subadmin: 4,
  admin: 4,
  gerente: 5,
  superadmin: 6
});

const CREATABLE_ROLES = Object.freeze({
  jefe_sector: Object.freeze(['coordinador', 'operador']),
  subadmin: Object.freeze(['jefe_sector', 'coordinador', 'operador']),
  admin: Object.freeze(['jefe_sector', 'coordinador', 'operador']),
  gerente: Object.freeze(['subadmin', 'jefe_sector', 'coordinador', 'operador']),
  superadmin: Object.freeze(['gerente', 'subadmin', 'jefe_sector', 'coordinador', 'operador'])
});

export const ROLE_LABELS = Object.freeze({
  gerente: 'Gerente de Tienda',
  subadmin: 'Subadministrador',
  jefe_sector: 'Jefe de Sector',
  coordinador: 'Coordinador de Sector',
  operador: 'Operador / Vendedor de Salon'
});

export function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return ROLE_ALIASES[normalized] || normalized;
}

export function getCreatableRoles(role) {
  return [...(CREATABLE_ROLES[normalizeRole(role)] || [])];
}

export function canResetPasswords(role) {
  return ['subadmin', 'admin', 'gerente', 'superadmin'].includes(normalizeRole(role));
}

export function canManageRole(actorRole, targetRole) {
  const actorLevel = ROLE_LEVELS[normalizeRole(actorRole)] || 0;
  const targetLevel = ROLE_LEVELS[normalizeRole(targetRole)] || 0;
  return actorLevel > 0 && targetLevel > 0 && actorLevel > targetLevel;
}
