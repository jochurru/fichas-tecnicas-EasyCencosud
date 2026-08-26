import React, { useEffect } from 'react';
import { RefreshCw, Database, Percent, ShieldAlert, AlertTriangle, ImageOff, FileQuestion, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';

/**
 * @fileoverview Sub-pestaña de Analítica y Calidad de Datos del Catálogo.
 * Muestra métricas de completitud, faltantes críticos, distribución por estado y productos que requieren atención.
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
      if (!res.ok) throw new Error(`Error ${res.status} al recuperar métricas de calidad`);
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

  const resumen = metrics?.resumen || {};
  const estados = metrics?.estados || {};
  const requierenAtencion = metrics?.requierenAtencion || [];

  const totalProductos = resumen.totalProductos || 0;
  const completas = resumen.completas || 0;
  const incompletas = resumen.incompletas || 0;
  const porcentajeCompleto = totalProductos > 0 ? Math.round((completas / totalProductos) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header y Botón Actualizar */}
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div>
          <h4 className="font-bold text-gray-800 text-sm">Calidad Global del Catálogo SAP</h4>
          <p className="text-xs text-gray-400 font-medium">Diagnóstico de completitud y faltantes técnicos en tiempo real</p>
        </div>
        <button 
          onClick={loadMetrics}
          disabled={metricsLoading}
          className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${metricsLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {metricsLoading ? (
        <div className="flex justify-center items-center py-12 text-gray-400 gap-2 text-xs font-bold">
          <RefreshCw className="w-5 h-5 animate-spin text-easy-red" /> Calculando métricas del catálogo...
        </div>
      ) : metricsError ? (
        <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-150">
          {metricsError}
        </div>
      ) : metrics ? (
        <>
          {/* 1. Tarjetas Resumen Principales */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <span className="text-2xl font-black text-gray-800">{totalProductos}</span>
                <span className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider">Total SKUs</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <Percent className="w-6 h-6" />
              </div>
              <div>
                <span className="text-2xl font-black text-gray-800">{porcentajeCompleto}%</span>
                <span className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider">Fichas Completas (≥80%)</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-2xl font-black text-gray-800">{incompletas}</span>
                <span className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider">Fichas Incompletas (&lt;80%)</span>
              </div>
            </div>
          </div>

          {/* 2. Tarjetas de Faltantes Críticos */}
          <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-3">
            <h5 className="font-bold text-gray-800 text-xs uppercase tracking-wide">Faltantes Críticos del Catálogo</h5>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-red-50/60 border border-red-100 p-3 rounded-xl text-center">
                <ImageOff className="w-5 h-5 text-red-500 mx-auto mb-1" />
                <div className="text-lg font-extrabold text-red-900">{resumen.sinImagen || 0}</div>
                <div className="text-[10px] text-red-600 font-bold">Sin Imagen</div>
              </div>

              <div className="bg-purple-50/60 border border-purple-100 p-3 rounded-xl text-center">
                <FileQuestion className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                <div className="text-lg font-extrabold text-purple-900">{resumen.sinEspecificaciones || 0}</div>
                <div className="text-[10px] text-purple-600 font-bold">Sin Specs</div>
              </div>

              <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl text-center">
                <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <div className="text-lg font-extrabold text-amber-900">{resumen.totalInconsistencias || 0}</div>
                <div className="text-[10px] text-amber-600 font-bold">Inconsistencias</div>
              </div>
            </div>
          </div>

          {/* 3. Distribución por Estado */}
          <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-3">
            <h5 className="font-bold text-gray-800 text-xs uppercase tracking-wide">Distribución por Estado del Ciclo de Vida</h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(estados).map(([est, count]) => (
                <div key={est} className="bg-gray-50 border border-gray-100 p-2.5 rounded-xl flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-600 truncate">{est}</span>
                  <span className="font-mono font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Lista de Productos que Requieren Atención */}
          {requierenAtencion.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-3">
              <h5 className="font-bold text-gray-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Productos Prioritarios a Corregir ({requierenAtencion.length})
              </h5>
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 text-xs">
                {requierenAtencion.map((item, idx) => (
                  <div key={idx} className="py-2 flex justify-between items-center">
                    <div>
                      <span className="font-mono font-bold text-gray-800 mr-2">{item.sku}</span>
                      <span className="text-gray-600 text-[11px] truncate max-w-[220px] inline-block align-bottom">{item.descripcion}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        item.completitud >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {item.completitud}%
                      </span>
                      <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {item.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
