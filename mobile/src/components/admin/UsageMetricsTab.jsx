import React from 'react';
import { 
  Clock, Printer, Search, Zap, CheckCircle2, Award, Users, 
  Eye, ShieldAlert, FileText 
} from 'lucide-react';

/**
 * @fileoverview Sub-pestaña completa para la visualización de Métricas de Uso, Ranking de SKUs y Actividad de Operadores.
 * Responsiva Mobile-First con tipografía destacada.
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
  const topSkus = stats.topSkus || [];
  const operadores = stats.operadores || [];

  const draftsCreated = ia.draftsCreated || 0;
  const draftsApproved = ia.draftsApproved || 0;
  const conversionPct = draftsCreated > 0 ? Math.round((draftsApproved / draftsCreated) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h4 className="font-extrabold text-gray-900 text-base sm:text-lg mb-1">Métricas de Uso y Eficiencia Operativa</h4>
        <p className="text-xs sm:text-sm text-gray-500 font-medium">
          Dashboard consolidado de horas ahorradas, demanda de productos y rendimiento de operadores en tiendas
        </p>
      </div>

      {/* 1. Tarjetas Principales de KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50/70 border border-emerald-150 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-emerald-700 text-xs sm:text-sm font-bold mb-1">
            <Clock className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Horas Ahorradas</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-950">{resumen.horasAhorradas || 0}h</div>
          <p className="text-[10px] sm:text-xs text-emerald-600 font-semibold mt-1">Estimado por automatización</p>
        </div>

        <div className="bg-blue-50/70 border border-blue-150 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-blue-700 text-xs sm:text-sm font-bold mb-1">
            <Printer className="w-4 h-4 shrink-0 text-blue-600" />
            <span>Impresiones</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-950">{resumen.impresiones || 0}</div>
          <p className="text-[10px] sm:text-xs text-blue-600 font-semibold mt-1">Fichas físicas emitidas</p>
        </div>

        <div className="bg-purple-50/70 border border-purple-150 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-purple-700 text-xs sm:text-sm font-bold mb-1">
            <Search className="w-4 h-4 shrink-0 text-purple-600" />
            <span>Búsquedas</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-950">{resumen.busquedas || 0}</div>
          <p className="text-[10px] sm:text-xs text-purple-600 font-semibold mt-1">Consultas de operador</p>
        </div>

        <div className="bg-amber-50/70 border border-amber-150 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-amber-700 text-xs sm:text-sm font-bold mb-1">
            <Zap className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Efectividad IA</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-950">{ia.tasaAceptacion || 0}%</div>
          <p className="text-[10px] sm:text-xs text-amber-600 font-semibold mt-1">Tasa de aprobación</p>
        </div>
      </div>

      {/* 2. Indicadores Secundarios de Operación */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className="bg-white border border-gray-150 p-3 sm:p-4 rounded-2xl flex sm:flex-col items-center justify-between sm:justify-center text-left sm:text-center shadow-xs">
          <div className="text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-gray-500 shrink-0" />
            <span>Aprobaciones</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-gray-800">{resumen.aprobaciones || 0}</div>
        </div>

        <div className="bg-white border border-gray-150 p-3 sm:p-4 rounded-2xl flex sm:flex-col items-center justify-between sm:justify-center text-left sm:text-center shadow-xs">
          <div className="text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-blue-500 shrink-0" />
            <span>Previsualizaciones</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-900">{resumen.vistasPrevias || 0}</div>
        </div>

        <div className="bg-white border border-gray-150 p-3 sm:p-4 rounded-2xl flex sm:flex-col items-center justify-between sm:justify-center text-left sm:text-center shadow-xs">
          <div className="text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
            <span>Logins Fallidos</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-red-900">{resumen.loginFailed || 0}</div>
        </div>
      </div>

      {/* 3. Barra de Conversión de Borradores IA */}
      <div className="bg-white border border-gray-150 p-5 rounded-2xl space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-xs sm:text-sm">
          <span className="font-extrabold text-gray-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-easy-red shrink-0" />
            Conversión de Borradores IA a Fichas Aprobadas
          </span>
          <span className="font-bold text-gray-600">
            {draftsApproved} aprobados de {draftsCreated} creados ({conversionPct}%)
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-easy-red h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(conversionPct, 100)}%` }}
          />
        </div>
      </div>

      {/* 4. Top 10 SKUs Más Demandados */}
      {topSkus.length > 0 && (
        <div className="bg-white border border-gray-150 p-5 rounded-2xl space-y-3 shadow-xs">
          <h5 className="font-extrabold text-gray-800 text-xs sm:text-sm uppercase tracking-wide flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            Top 10 SKUs Más Consultados e Impresos
          </h5>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-150 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="pb-2 pl-1">#</th>
                  <th className="pb-2">SKU</th>
                  <th className="pb-2 text-center">Operaciones Totales</th>
                  <th className="pb-2 text-right pr-1">Impresiones Físicas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {topSkus.map((item, idx) => (
                  <tr key={item.sku} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-2.5 pl-1 font-bold text-gray-400">{idx + 1}</td>
                    <td className="py-2.5 font-mono font-extrabold text-gray-900">{item.sku}</td>
                    <td className="py-2.5 text-center">
                      <span className="bg-purple-50 text-purple-700 font-bold px-2.5 py-1 rounded-lg border border-purple-100 text-xs">
                        {item.total} ops
                      </span>
                    </td>
                    <td className="py-2.5 text-right pr-1 font-bold text-blue-700">
                      {item.impresiones} impresiones
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Ranking de Operadores y Tiendas */}
      {operadores.length > 0 && (
        <div className="bg-white border border-gray-150 p-5 rounded-2xl space-y-3 shadow-xs">
          <h5 className="font-extrabold text-gray-800 text-xs sm:text-sm uppercase tracking-wide flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            Actividad por Usuario / Operador
          </h5>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-150 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="pb-2 pl-1">Usuario / Email</th>
                  <th className="pb-2">Rol</th>
                  <th className="pb-2 text-center">Búsquedas</th>
                  <th className="pb-2 text-center">Aprobaciones</th>
                  <th className="pb-2 text-right pr-1">Impresiones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {operadores.map((op) => (
                  <tr key={op.email} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-2.5 pl-1 font-bold text-gray-800">{op.email}</td>
                    <td className="py-2.5">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        op.rol === 'ADMIN' ? 'bg-red-100 text-easy-red' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {op.rol}
                      </span>
                    </td>
                    <td className="py-2.5 text-center font-mono font-bold">{op.busquedas}</td>
                    <td className="py-2.5 text-center font-mono text-emerald-700 font-bold">{op.aprobaciones}</td>
                    <td className="py-2.5 text-right pr-1 font-mono text-blue-700 font-bold">{op.impresiones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
