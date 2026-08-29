ALTER TABLE usuarios_roles DROP CONSTRAINT IF EXISTS usuarios_roles_role_check;
ALTER TABLE usuarios_roles ADD CONSTRAINT usuarios_roles_role_check
  CHECK (role IN ('operator', 'coordinator', 'admin', 'superadmin'));

INSERT INTO usuarios_roles (email, role)
VALUES ('jonatan.churruarin@outlook.com', 'superadmin')
ON CONFLICT (email) DO UPDATE SET role = 'superadmin';
