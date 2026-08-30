import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  Printer, 
  RefreshCw, 
  ArrowRightLeft, 
  FileDown, 
  Eye, 
  Award, 
  Layers, 
  Clock, 
  ChevronRight,
  Flame
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { STORE_BLOCKS } from '../../config/storeBlocks';

export default function ExecutiveDashboardTab({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [topActivity, setTopActivity] = useState([]);
  const [isRotateModalOpen, setIsRotateModalOpen] = useState(false);
  const [selectedBlock1, setSelectedBlock1] = useState(1);
  const [selectedBlock2, setSelectedBlock2] = useState(2);
  const [rotationSuccess, setRotationSuccess] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchKpis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/gerencia/kpis-bloques`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Error al cargar métricas ejecutivas.');
      const result = await res.json();
      setData(result);

      // Cargar actividad de salón
      const actRes = await fetch(`${API_BASE_URL}/gerencia/top-actividad-salon`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (actRes.ok) {
        const actData = await actRes.json();
        setTopActivity(actData || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, []);

  const handleExecuteRotation = async () => {
    if (selectedBlock1 === selectedBlock2) {
      alert('Seleccioná dos bloques diferentes para realizar el intercambio.');
      return;
    }
    try {
      const b1 = STORE_BLOCKS.find(b => b.id === Number(selectedBlock1));
      const b2 = STORE_BLOCKS.find(b => b.id === Number(selectedBlock2));

      const res = await fetch(`${API_BASE_URL}/gerencia/rotar-jefe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          jefeEmail1: b1.jefe_email,
          jefeEmail2: b2.jefe_email,
          bloqueId1: b1.id,
          bloqueId2: b2.id
        })
      });

      if (!res.ok) throw new Error('Error al ejecutar la rotación.');
      setRotationSuccess(`✓ Se reasignó a ${b1.jefe_nombre} al bloque ${b2.nombre} y a ${b2.jefe_nombre} al bloque ${b1.nombre}.`);
      setTimeout(() => {
        setIsRotateModalOpen(false);
        setRotationSuccess('');
        fetchKpis();
      }, 2200);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleExportExecutiveReport = () => {
    setExporting(true);
    setTimeout(() => {
      window.print();
      setExporting(false);
    }, 500);
  };

  if (loading) {
    return (
      <div className="py-16 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-easy-red mx-auto" />
        <p className="text-xs font-bold text-slate-500">Consolidando métricas ejecutivas de la tienda...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-700 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const resumen = data?.resumenGlobal || {};
  const bloques = data?.bloques || [];

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. Header Ejecutivo y Acciones Rápidas */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-black flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> Nivel Gerencial
            </span>
            <span className="text-xs text-slate-400 font-mono">Easy Cencosud • Tienda Central</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mt-1 tracking-tight">
            Centro de Mando y Desempeño
          </h2>
          <p className="text-xs text-slate-300 max-w-xl mt-0.5">
            Supervisión integral de los 4 Bloques departamentales, cobertura de catálogo y rotación de jefaturas.
          </p>
        </div>

        {/* Botones de Acción de Gerencia */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setIsRotateModalOpen(true)}
            className="flex-1 sm:flex-none bg-slate-700/80 hover:bg-slate-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-600 transition flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
          >
            <ArrowRightLeft className="w-4 h-4 text-amber-400" />
            <span>Rotar Jefes</span>
          </button>

          <button
            onClick={handleExportExecutiveReport}
            className="flex-1 sm:flex-none bg-easy-red hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-red-900/40 transition flex items-center justify-center gap-1.5 active:scale-95"
          >
            <FileDown className="w-4 h-4" />
            <span>{exporting ? 'Generando...' : 'Descargar Informe'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPIs Macro de la Sucursal (Grid 4x1 en PC / 2x2 en Celular) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total SKUs */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Catálogo Tienda</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 mt-1">
            {resumen.totalTiendaSkus?.toLocaleString('es-AR') || 0}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">20 Sectores Oficiales SAP</div>
        </div>

        {/* Fichas Aprobadas */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-bold">
            <span>Fichas Aprobadas</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
            {resumen.totalAprobadas?.toLocaleString('es-AR') || 0}
          </div>
          <div className="text-[11px] text-emerald-600 font-bold mt-0.5">
            {resumen.coberturaGlobal || 0}% de Cobertura Global
          </div>
        </div>

        {/* Cuellos de Botella / Pendientes */}
        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-600 text-xs font-bold">
            <span>En Revisión</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
            {resumen.totalPendientes || 0}
          </div>
          <div className="text-[11px] text-amber-600 font-medium mt-0.5">Pendientes en Jefaturas</div>
        </div>

        {/* Jefaturas y Equipos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Estructura</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 mt-1">
            4 Bloques
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">100% de Jefes Asignados</div>
        </div>
      </div>

      {/* 3. Semáforo y Rendimiento por Bloque Departamental */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span>🚦 Semáforo de Cumplimiento por Bloque</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Actualizado en tiempo real</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {bloques.map((block) => {
            const isGreen = block.semaforo === 'VERDE';
            const isYellow = block.semaforo === 'AMARILLO';

            return (
              <div 
                key={block.id} 
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  {/* Encabezado de Bloque y Semáforo */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Bloque {block.id}
                      </span>
                      <h4 className="text-sm font-black text-slate-800 leading-tight mt-0.5">
                        {block.nombre}
                      </h4>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 ${
                      isGreen 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : isYellow 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${isGreen ? 'bg-emerald-500' : isYellow ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                      {block.semaforo}
                    </span>
                  </div>

                  {/* Responsable Actual */}
                  <div className="mt-3 p-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Jefe Responsable</div>
                      <div className="text-xs font-black text-slate-700">{block.jefe_nombre}</div>
                    </div>
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                      {block.sectores.length} Sectores
                    </span>
                  </div>

                  {/* Barra de Progreso de Cobertura */}
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-600">Cobertura de Fichas</span>
                      <span className={isGreen ? 'text-emerald-600' : isYellow ? 'text-amber-600' : 'text-red-600'}>
                        {block.coberturaPorcentaje}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isGreen ? 'bg-emerald-500' : isYellow ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(block.coberturaPorcentaje, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Métricas del Bloque */}
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <div className="text-xs font-black text-slate-800">{block.totalSkus}</div>
                      <div className="text-[9px] text-slate-400 uppercase font-bold">Total SKUs</div>
                    </div>
                    <div className="p-2 bg-emerald-50/50 rounded-xl">
                      <div className="text-xs font-black text-emerald-700">{block.aprobadas}</div>
                      <div className="text-[9px] text-emerald-600 uppercase font-bold">Aprobadas</div>
                    </div>
                    <div className="p-2 bg-amber-50/50 rounded-xl">
                      <div className="text-xs font-black text-amber-700">{block.pendientes}</div>
                      <div className="text-[9px] text-amber-600 uppercase font-bold">Pendientes</div>
                    </div>
                  </div>
                </div>

                {/* Footer de Tarjeta con Impresiones y Sectores */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Printer className="w-3.5 h-3.5 text-slate-400" /> {block.impresionesMes} impresas
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" /> {block.equipoPersonal} en equipo
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Monitor de Actividad en Góndola y Salón de Ventas */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>Monitoreo de Piso de Venta: SKUs Más Activos</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Productos con mayor volumen de consulta e impresión de fichas en salón.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                <th className="p-3">SKU / Descripción</th>
                <th className="p-3">Sector</th>
                <th className="p-3 text-center">Consultas Salón</th>
                <th className="p-3 text-center">Fichas Impresas</th>
                <th className="p-3 text-right">Estado Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topActivity.map((item) => (
                <tr key={item.sku} className="hover:bg-slate-50/60 transition">
                  <td className="p-3">
                    <div className="font-bold text-slate-800">{item.descripcion}</div>
                    <div className="text-[11px] font-mono text-slate-400">SKU: {item.sku}</div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                      Sector {item.sectorPrefix}
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-700">
                    {item.consultas}
                  </td>
                  <td className="p-3 text-center font-bold text-slate-700">
                    {item.impresiones}
                  </td>
                  <td className="p-3 text-right">
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3" /> {item.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE ROTACIÓN RÁPIDA DE JEFES */}
      {isRotateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-500" />
                <span>Rotación y Reasignación de Jefaturas</span>
              </h3>
              <button 
                onClick={() => setIsRotateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Seleccioná los dos bloques departamentales para rotar a sus respectivos Jefes. La herencia de sectores, coordinadores y bandejas de pendientes se transferirá en cascada inmediatamente.
            </p>

            {rotationSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                {rotationSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Primer Bloque</label>
                <select
                  value={selectedBlock1}
                  onChange={(e) => setSelectedBlock1(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white"
                >
                  {STORE_BLOCKS.map(b => (
                    <option key={b.id} value={b.id}>{b.nombre} ({b.jefe_nombre})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Segundo Bloque (Intercambio)</label>
                <select
                  value={selectedBlock2}
                  onChange={(e) => setSelectedBlock2(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white"
                >
                  {STORE_BLOCKS.map(b => (
                    <option key={b.id} value={b.id}>{b.nombre} ({b.jefe_nombre})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsRotateModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteRotation}
                className="bg-slate-900 hover:bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition"
              >
                Confirmar Rotación en Cascada
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
