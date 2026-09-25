import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

let server;
let baseUrl;

before(async () => {
  process.env.PORT = '0';
  process.env.NODE_ENV = 'test';
  process.env.SKIP_STARTUP_INIT = 'true';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';
  process.env.SUPABASE_KEY = 'mock-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.ADMIN_PASSWORD = '';
  process.env.COORD_PASSWORD = '';
  process.env.USER_PASSWORD = '';

  ({ server } = await import('../index.js'));
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('health responde sin exponer credenciales y con headers de Helmet', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.env, 'test');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(JSON.stringify(body).includes('mock-service-role-key'), false);
});

test('CORS permite localhost configurado y no habilita origenes desconocidos', async () => {
  const allowed = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'http://localhost:5173' }
  });
  const denied = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'https://attacker.example' }
  });

  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('login rechaza dominio externo y contrasena corta antes de consultar Auth', async () => {
  const cases = [
    { email: 'persona@example.com', password: 'Password123!' },
    { email: 'persona@easy.com.ar', password: '123' }
  ];

  for (const body of cases) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 400);
  }
});

test('endpoints sensibles rechazan solicitudes sin token', async () => {
  const requests = [
    ['GET', '/api/producto/123'],
    ['POST', '/api/fichas/sugerir'],
    ['POST', '/api/fichas/aprobar'],
    ['GET', '/api/fichas/123/historial'],
    ['GET', '/api/fichas/123/pdf'],
    ['POST', '/api/fichas/imprimir'],
    ['POST', '/api/fichas/imprimir-lote'],
    ['POST', '/api/catalogos/importar'],
    ['POST', '/api/catalogos/importar-eans'],
    ['GET', '/api/catalogos/metricas'],
    ['GET', '/api/admin/calidad-catalogo'],
    ['POST', '/api/upload/imagen'],
    ['GET', '/api/marcas'],
    ['POST', '/api/marcas'],
    ['DELETE', '/api/marcas/demo'],
    ['GET', '/api/admin/usuarios'],
    ['POST', '/api/admin/usuarios'],
    ['GET', '/api/aprobaciones/pendientes'],
    ['POST', '/api/aprobaciones/demo/aprobar'],
    ['POST', '/api/aprobaciones/demo/rechazar'],
    ['GET', '/api/gerencia/kpis-bloques'],
    ['GET', '/api/admin/database-viewer?tableName=productos']
  ];

  for (const [method, pathname] of requests) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (method !== 'GET') options.body = '{}';
    const response = await fetch(`${baseUrl}${pathname}`, options);
    const body = await response.json();

    assert.equal(response.status, 401, `${method} ${pathname}`);
    assert.equal(body.error, 'Unauthorized', `${method} ${pathname}`);
  }
});
