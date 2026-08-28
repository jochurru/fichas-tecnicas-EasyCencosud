import React, { useState, useEffect } from 'react';
import { Activity, Database, FileText, Cpu, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function SystemHealthTab() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/admin/estado-sistema`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Error fetching system health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  if (loading && !health) {
    return <div className="p-4 text-center">Cargando estado del sistema...</div>;
  }

  if (error && !health) {
    return <div className="p-4 text-red-500 text-center">{error}</div>;
  }

  const statusColor = (status) => status === 'ok' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-bold text-gray-900">Estado del Sistema</h4>
        <button onClick={fetchHealth} disabled={loading} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
          <RefreshCw className={"w-4 h-4 " + (loading ? "animate-spin" : "")} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backend */}
        <div className="border p-4 rounded-xl flex items-start gap-3">
          <Cpu className="text-blue-500 w-6 h-6" />
          <div>
            <h5 className="font-bold text-sm">Servidor Backend</h5>
            <p className="text-xs text-gray-500">Uptime: {Math.round(health.backend.uptime / 60)} min</p>
            <p className="text-xs text-gray-500">Entorno: {health.backend.env}</p>
          </div>
        </div>

        {/* Base de datos */}
        <div className={"border p-4 rounded-xl flex items-start gap-3 " + statusColor(health.db.status)}>
          <Database className="w-6 h-6" />
          <div>
            <h5 className="font-bold text-sm">Base de Datos (Supabase)</h5>
            <p className="text-xs">Estado: {health.db.status.toUpperCase()}</p>
            <p className="text-xs">Latencia: {health.db.latencyMs} ms</p>
          </div>
        </div>

        {/* PDF Generator */}
        <div className={"border p-4 rounded-xl flex items-start gap-3 " + statusColor(health.pdf.status)}>
          <FileText className="w-6 h-6" />
          <div>
            <h5 className="font-bold text-sm">Motor PDF (Puppeteer)</h5>
            <p className="text-xs">Conectado: {health.pdf.status === 'ok' ? 'Sí' : 'No'}</p>
            <p className="text-xs">Páginas activas: {health.pdf.activePages} / {health.pdf.maxPages}</p>
          </div>
        </div>

        {/* Inteligencia Artificial */}
        <div className={"border p-4 rounded-xl flex items-start gap-3 " + (health.ai.lastResult.includes('success') || health.ai.lastResult === 'idle' ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50')}>
          <Activity className="w-6 h-6" />
          <div>
            <h5 className="font-bold text-sm">Inteligencia Artificial</h5>
            <p className="text-xs">Último llamado: {health.ai.lastCall ? new Date(health.ai.lastCall).toLocaleString() : 'Ninguno'}</p>
            <p className="text-xs font-bold">Resultado: {health.ai.lastResult}</p>
            {health.ai.lastError && <p className="text-xs mt-1 text-red-500 line-clamp-2">{health.ai.lastError}</p>}
          </div>
        </div>

        {/* Rate Limiter */}
        <div className={"border p-4 rounded-xl flex items-start gap-3 " + (health.rateLimiter.status === 'ok_db' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200')}>
          {health.rateLimiter.status === 'ok_db' ? (
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
          )}
          <div>
            <h5 className="font-bold text-sm">Control de Tráfico (Rate Limiter)</h5>
            <p className="text-xs">Modo: {health.rateLimiter.status === 'ok_db' ? 'Base de Datos (Compartido)' : 'Memoria RAM (Local)'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
