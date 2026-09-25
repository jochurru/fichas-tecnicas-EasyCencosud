function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return globalThis.atob(`${normalized}${padding}`);
}

export function getJwtExpirationMs(token) {
  if (!token || typeof token !== 'string') return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(decodeBase64Url(parts[1]));
    const expirationSeconds = Number(payload.exp);
    return Number.isFinite(expirationSeconds) ? expirationSeconds * 1000 : null;
  } catch {
    return null;
  }
}

export function isJwtExpired(token, nowMs = Date.now()) {
  const expirationMs = getJwtExpirationMs(token);
  return expirationMs === null || expirationMs <= nowMs;
}
