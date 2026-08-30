// Configuración global de URLs de API
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = import.meta.env.VITE_API_URL || (
  isLocal
    ? '/api'
    : 'https://fichas-tecnicas-easycencosud-686548224349.us-central1.run.app/api'
);
