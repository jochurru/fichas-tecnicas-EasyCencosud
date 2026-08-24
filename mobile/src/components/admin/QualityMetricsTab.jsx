import React, { useEffect } from 'react';
import { RefreshCw, Database, Percent, ShieldAlert } from 'lucide-react';
import { API_BASE_URL } from '../../config';

/**
 * @fileoverview Sub-pestaña de Analítica y Calidad de Datos del Catálogo.
 * Muestra el porcentaje de completitud, fallas de EANs y fotos faltantes.
 */

export default function QualityMetricsTab({
  metrics,
  setMetrics,
  metricsLoading,
  setMetricsLoading,
  metricsError,
  setMetricsError,
  token
}) {
  const loadMetrics = async () => {
    setMetricsLoading(true);
    setMetricsError('');
    try {
      const res = await fetch(`${API_BASE_URL}/admin/calidad-catalogo`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Error ${res.status} al recuperar métricas`);
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      setMetricsError(err.message);
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div>
          <h4 className="font-bold text-gray-800 text-sm">Calidad Global del Catálogo</h4>
          <p className="text-xs text-gray-400 font-medium">Diagnóstico de completitud de fichas técnicas</p>
        </div>
        <button 
          onClick={loadMetrics}
          disabled={metricsLoading}
          className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${metricsLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {metricsLoading ? (
        <div className="flex justify-center items-center py-12 text-gray-400 gap-2 text-xs font-bold">
          <RefreshCw className="w-5 h-5 animate-spin text-easy-red" /> Cargando analítica...
        </div>
      ) : metricsError ? (
        <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-150">
          {metricsError}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-easy-red flex items-center justify-center font-bold">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-gray-800">{metrics.totalProductos || 0}</span>
              <span className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider">Total Fichas</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center font-bold">
              <Percent className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-gray-800">{metrics.promedioCompletitud || 0}%</span>
              <span className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider">Promedio Completitud</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-gray-800">{metrics.incompletos || 0}</span>
              <span className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider">Fichas Incompletas</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
