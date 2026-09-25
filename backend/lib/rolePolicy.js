export const OPERATOR_ROLES = Object.freeze(['operador', 'operator']);

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

export const USER_MANAGER_ROLES = Object.freeze([
  'jefe_sector',
  'subadmin',
  'admin',
  'gerente',
  'superadmin'
]);

export const PASSWORD_RESET_ROLES = Object.freeze([
  'subadmin',
  'admin',
  'gerente',
  'superadmin'
]);

const CREATABLE_ROLES = Object.freeze({
  jefe_sector: Object.freeze(['coordinador', 'operador']),
  subadmin: Object.freeze(['jefe_sector', 'coordinador', 'operador']),
  admin: Object.freeze(['jefe_sector', 'coordinador', 'operador']),
  gerente: Object.freeze(['subadmin', 'jefe_sector', 'coordinador', 'operador']),
  superadmin: Object.freeze(['gerente', 'subadmin', 'jefe_sector', 'coordinador', 'operador'])
});

export function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return ROLE_ALIASES[normalized] || normalized;
}

export function getCreatableRoles(role) {
  return [...(CREATABLE_ROLES[normalizeRole(role)] || [])];
}

export function canCreateRole(actorRole, targetRole) {
  return getCreatableRoles(actorRole).includes(normalizeRole(targetRole));
}

export function canResetPasswords(role) {
  return PASSWORD_RESET_ROLES.includes(normalizeRole(role));
}

export function canManageRole(actorRole, targetRole) {
  const actorLevel = ROLE_LEVELS[normalizeRole(actorRole)] || 0;
  const targetLevel = ROLE_LEVELS[normalizeRole(targetRole)] || 0;
  return actorLevel > 0 && targetLevel > 0 && actorLevel > targetLevel;
}

export function getStoredRoleVariants(roles) {
  const variants = new Set(roles.map(normalizeRole));
  if (variants.has('operador')) variants.add('operator');
  if (variants.has('coordinador')) variants.add('coordinator');
  return [...variants];
}

export const OFFICIAL_EDITOR_ROLES = Object.freeze([
  'gerente',
  'subadmin',
  'jefe_sector',
  'coordinador',
  'coordinator',
  'admin',
  'superadmin'
]);

export const IMAGE_MANAGER_ROLES = OFFICIAL_EDITOR_ROLES;

export function isOperatorRole(role) {
  return normalizeRole(role) === 'operador';
}

export function canManageImages(role) {
  return IMAGE_MANAGER_ROLES.includes(role);
}

export function canEditOfficialFicha(role) {
  return OFFICIAL_EDITOR_ROLES.includes(role);
}
