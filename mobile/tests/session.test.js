import test from 'node:test';
import assert from 'node:assert/strict';
import { getJwtExpirationMs, isJwtExpired } from '../src/utils/session.js';

function buildToken(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
}

test('obtiene el vencimiento de un JWT valido', () => {
  const token = buildToken({ exp: 1_800_000_000 });
  assert.equal(getJwtExpirationMs(token), 1_800_000_000_000);
});

test('detecta tokens vencidos y vigentes', () => {
  const now = 1_800_000_000_000;
  assert.equal(isJwtExpired(buildToken({ exp: 1_799_999_999 }), now), true);
  assert.equal(isJwtExpired(buildToken({ exp: 1_800_000_001 }), now), false);
});

test('trata tokens malformados o sin exp como vencidos', () => {
  assert.equal(isJwtExpired('token-invalido'), true);
  assert.equal(isJwtExpired(buildToken({ sub: 'usuario' })), true);
});
