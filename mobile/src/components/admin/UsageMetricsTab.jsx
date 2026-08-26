import React from 'react';
import { Clock, Printer, Search, Zap, CheckCircle2 } from 'lucide-react';

/**
 * @fileoverview Sub-pestaña para la visualización de Métricas de Uso y Eficiencia Operativa.
 */

export default function UsageMetricsTab({ stats }) {
  if (!stats) {
    return (
      <div className="py-12 text-center text-gray-400 text-xs font-semibold">
        Cargando métricas de uso y rendimiento...
      </div>
    );
  }

  const resumen = stats.resumen || {};
  const ia = stats.ia || {};
  const draftsCreated = ia.draftsCreated || 0;
  const draftsApproved = ia.draftsApproved || 0;
  const conversionPct = draftsCreated > 0 ? Math.round((draftsApproved / draftsCreated) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-extrabold text-gray-800 text-sm mb-1">Métricas de Uso y Eficiencia Operativa</h4>
        <p className="text-xs text-gray-400 font-medium">
          Indicadores clave de ahorro de tiempo, impresiones y efectividad de borradores IA
        </p>
      </div>

      {/* Tarjetas Principales de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold mb-1">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Horas Ahorradas</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-900">{resumen.horasAhorradas || 0}h</div>
          <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Estimado por automatización</p>
        </div>

        <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-blue-700 text-xs font-bold mb-1">
            <Printer className="w-4 h-4 shrink-0" />
            <span>Impresiones</span>
          </div>
          <div className="text-2xl font-extrabold text-blue-900">{resumen.impresiones || 0}</div>
          <p className="text-[10px] text-blue-600 font-medium mt-0.5">Fichas físicas emitidas</p>
        </div>

        <div className="bg-purple-50/70 border border-purple-100 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-purple-700 text-xs font-bold mb-1">
            <Search className="w-4 h-4 shrink-0" />
            <span>Búsquedas</span>
          </div>
          <div className="text-2xl font-extrabold text-purple-900">{resumen.busquedas || 0}</div>
          <p className="text-[10px] text-purple-600 font-medium mt-0.5">Consultas de operador</p>
        </div>

        <div className="bg-amber-50/70 border border-amber-100 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-amber-700 text-xs font-bold mb-1">
            <Zap className="w-4 h-4 shrink-0" />
            <span>Efectividad IA</span>
          </div>
          <div className="text-2xl font-extrabold text-amber-900">{ia.tasaAceptacion || 0}%</div>
          <p className="text-[10px] text-amber-600 font-medium mt-0.5">Tasa de aprobación</p>
        </div>
      </div>

      {/* Barra de Conversión de Borradores IA */}
      <div className="bg-white border border-gray-150 p-5 rounded-2xl space-y-3 shadow-xs">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-gray-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-easy-red" />
            Conversión de Borradores IA
          </span>
          <span className="font-bold text-gray-600">
            {draftsApproved} aprobados de {draftsCreated} creados ({conversionPct}%)
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div 
            className="bg-easy-red h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(conversionPct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
