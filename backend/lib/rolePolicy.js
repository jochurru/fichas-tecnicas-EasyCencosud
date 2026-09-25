export const OPERATOR_ROLES = Object.freeze(['operador', 'operator']);

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
  return OPERATOR_ROLES.includes(role);
}

export function canManageImages(role) {
  return IMAGE_MANAGER_ROLES.includes(role);
}

export function canEditOfficialFicha(role) {
  return OFFICIAL_EDITOR_ROLES.includes(role);
}
