import React, { useState, useEffect } from 'react';
import { 
  X, UploadCloud, AlertCircle, CheckCircle, 
  RefreshCw, FileSpreadsheet, KeyRound, ArrowRight,
  Database, QrCode, TrendingUp, Clock, Award,
  FileText, Percent, ShieldAlert, BarChart2, Check, UserCheck
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function AdminPanel({ token, onClose, onTokenExpired }) {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'ean' | 'analytics'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [stats, setStats] = useState(null);
  const [newSkus, setNewSkus] = useState([]);
  const [taskProgress, setTaskProgress] = useState(null);

  // Estados de Métricas y Analítica
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState('');

  // Efecto para cargar métricas al cambiar a la pestaña 'analytics'
  useEffect(() => {
    if (activeTab === 'analytics') {
      loadMetrics();
    }
  }, [activeTab]);

  const loadMetrics = async () => {
    setMetricsLoading(true);
    setMetricsError('');
    try {
      const res = await fetch(`${API_BASE_URL}/catalogos/metricas`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.status === 401 || res.status === 403) {
        if (onTokenExpired) {
          onTokenExpired();
        }
        return;
      }
      
      if (!res.ok) {
        throw new Error('No se pudo establecer conexión para recuperar reportes.');
      }
      
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      setMetricsError(err.message || 'Error desconocido al obtener métricas.');
    } finally {
      setMetricsLoading(false);
    }
  };

  // Estados y efecto para Calidad de Catálogo (P1.5)
  const [qualityData, setQualityData] = useState(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityError, setQualityError] = useState('');
  
  // Filtros
  const [filterEstado, setFilterEstado] = useState('ALL');
  const [searchTermQuality, setSearchTermQuality] = useState('');

  useEffect(() => {
    if (activeTab === 'quality') {
      loadQualityData();
    }
  }, [activeTab]);

  const loadQualityData = async () => {
    setQualityLoading(true);
    setQualityError('');
    try {
      const res = await fetch(`${API_BASE_URL}/admin/calidad-catalogo`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.status === 401 || res.status === 403) {
        if (onTokenExpired) {
          onTokenExpired();
        }
        return;
      }
      
      if (!res.ok) {
        throw new Error('No se pudo establecer conexión para recuperar reportes de calidad.');
      }
      
      const data = await res.json();
      setQualityData(data);
    } catch (err) {
      setQualityError(err.message || 'Error desconocido al obtener métricas de calidad.');
    } finally {
      setQualityLoading(false);
    }
  };

  // Drag and Drop Helpers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcessing(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcessing(e.target.files[0]);
    }
  };

  // Procesar archivo XLSX/XLS e importar
  const handleFileProcessing = (file) => {
    setErrorMsg('');
    setSuccessMsg('');
    setStats(null);
    setNewSkus([]);

    // Validar tipo de archivo
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (fileExt !== 'xlsx' && fileExt !== 'xls') {
      setErrorMsg('Formato de archivo inválido. Por favor, suba un archivo Excel (.xlsx o .xls)');
      return;
    }

    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64String = event.target.result.split(',')[1];

        // Seleccionar endpoint basado en la pestaña activa
        const endpoint = activeTab === 'catalog' 
          ? `${API_BASE_URL}/catalogos/importar` 
          : `${API_BASE_URL}/catalogos/importar-eans`;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ fileBase64: base64String })
        });

        const data = await res.json();
        
        if (res.status === 401 || res.status === 403) {
          if (onTokenExpired) {
            onTokenExpired();
          } else {
            throw new Error('Sesión expirada o privilegios insuficientes. Por favor, vuelve a ingresar.');
          }
          return;
        }

        if (!res.ok) {
          throw new Error(data.message || 'Error en la importación.');
        }

        if (data.taskId) {
          // Iniciar polling para consultar el progreso en segundo plano
          setTaskProgress({ percentage: 0, processed: 0, total: 0 });
          
          const interval = setInterval(async () => {
            try {
              const progressRes = await fetch(`${API_BASE_URL}/catalogos/tareas/${data.taskId}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });

              if (progressRes.status === 401 || progressRes.status === 403) {
                clearInterval(interval);
                if (onTokenExpired) {
                  onTokenExpired();
                } else {
                  setErrorMsg('Sesión expirada durante el procesamiento.');
                  setLoading(false);
                  setTaskProgress(null);
                }
                return;
              }

              if (!progressRes.ok) {
                clearInterval(interval);
                setErrorMsg('No se pudo recuperar el progreso de la carga SAP.');
                setLoading(false);
                setTaskProgress(null);
                return;
              }

              const task = await progressRes.json();
              setTaskProgress(task);

              if (task.status === 'completed') {
                clearInterval(interval);
                setStats(task.estadisticas);
                setNewSkus(task.estadisticas.nuevosSkus || []);
                setSuccessMsg('¡Catálogo SAP importado y sincronizado correctamente en segundo plano!');
                setLoading(false);
                setTaskProgress(null);
              } else if (task.status === 'failed') {
                clearInterval(interval);
                setErrorMsg(task.error || 'Ocurrió un error en segundo plano al cargar el Excel.');
                setLoading(false);
                setTaskProgress(null);
              }
            } catch (pollErr) {
              console.error('[AdminPanel] Error al consultar progreso:', pollErr);
            }
          }, 1500);
        } else {
          // Fallback síncrono (ej. importar EANs)
          setStats(data.estadisticas);
          setSuccessMsg('¡Mapeo de códigos de barras EAN cargado con éxito!');
          setLoading(false);
        }
      } catch (err) {
        setErrorMsg(err.message);
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg('Error al leer el archivo Excel.');
      setLoading(false);
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-easy-dark/60 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header del Modal */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-easy-red" />
            <h2 className="text-sm font-bold uppercase text-easy-dark tracking-wide">
              Panel Administrativo SAP
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-easy-red hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido del Modal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* Pantalla de Carga de Excel */}
          <div className="space-y-5">
            
            {/* Info de sesión */}
            <div className="flex justify-between items-center bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold text-gray-600">Sesión activa (Administrador)</span>
              </div>
            </div>

            {/* Selector de Pestañas (Modo de Carga / Métricas / Calidad) */}
            {!loading && !stats && (
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('catalog')}
                  className={`flex-grow py-2.5 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-1.5 ${
                    activeTab === 'catalog'
                      ? 'bg-white text-easy-dark shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" /> Catálogo SAP
                </button>
                <button
                  onClick={() => setActiveTab('ean')}
                  className={`flex-grow py-2.5 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-1.5 ${
                    activeTab === 'ean'
                      ? 'bg-white text-easy-dark shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" /> Mapeo EAN
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex-grow py-2.5 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-1.5 ${
                    activeTab === 'analytics'
                      ? 'bg-white text-easy-dark shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" /> Métricas
                </button>
                <button
                  onClick={() => setActiveTab('quality')}
                  className={`flex-grow py-2.5 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-1.5 ${
                    activeTab === 'quality'
                      ? 'bg-white text-easy-dark shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" /> Calidad
                </button>
              </div>
            )}

            {/* Zona de Drop para Archivos (Solo visible en pestañas de Carga SAP/EAN) */}
            {!loading && !stats && (activeTab === 'catalog' || activeTab === 'ean') && (
              <div 
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col justify-center items-center text-center transition-all ${
                  dragActive 
                    ? 'border-easy-red bg-red-50 text-easy-red' 
                    : 'border-gray-200 hover:border-easy-red bg-gray-50 hover:bg-red-50/20 text-gray-500'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <UploadCloud className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-sm font-bold text-gray-700 mb-1">
                  Arrastrá tu reporte Excel aquí
                </p>
                <p className="text-xs text-gray-400 mb-4 max-w-[200px]">
                  {activeTab === 'catalog' 
                    ? 'Planilla SAP exportada con grupo de compra 45.' 
                    : 'Planilla XLSX con columnas "SKU" y "EAN".'}
                </p>
                <label className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs shadow-sm cursor-pointer active:scale-95 transition-all">
                  Seleccionar archivo
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".xlsx,.xls" 
                    onChange={handleFileInput} 
                  />
                </label>
              </div>
            )}

            {/* Spinner de Carga y Barra de Progreso */}
            {loading && (
              <div className="py-8 flex flex-col items-center justify-center text-center gap-4">
                <RefreshCw className="w-10 h-10 text-easy-red animate-spin" />
                <div>
                  <p className="font-bold text-sm text-gray-700 font-mono">
                    {taskProgress ? `Procesando: ${taskProgress.percentage}%` : 'Procesando planilla Excel...'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {taskProgress 
                      ? `Sincronizando ${taskProgress.processed} de ${taskProgress.total} registros` 
                      : 'Subiendo archivo y preparando base de datos Supabase...'}
                  </p>
                </div>

                {taskProgress && (
                  <div className="w-full max-w-xs bg-gray-100 rounded-full h-2.5 overflow-hidden mt-1 border border-gray-200">
                    <div 
                      className="bg-easy-red h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${taskProgress.percentage}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}

            {/* Mensajes de Feedback */}
            {errorMsg && !loading && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3.5 flex gap-2.5 text-xs items-start">
                <AlertCircle className="w-4 h-4 text-easy-red shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block">Error de procesamiento</strong>
                  <p className="text-red-700 mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {successMsg && !loading && (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3.5 flex gap-2.5 text-xs items-start">
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block">Procesamiento completado</strong>
                  <p className="text-green-700 mt-0.5">{successMsg}</p>
                </div>
              </div>
            )}

            {/* Estadísticas de Importación */}
            {stats && !loading && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                    <span className="block text-lg font-black text-easy-dark">
                      {stats.totalProcesados || stats.totalMapeados || 0}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      Leídos
                    </span>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                    <span className="block text-lg font-black text-green-600">
                      {stats.nuevos || stats.insertados || 0}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      Nuevos
                    </span>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                    <span className="block text-lg font-black text-blue-600">
                      {stats.actualizados || stats.omitidos || 0}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      {activeTab === 'catalog' ? 'Actualizados' : 'Existentes'}
                    </span>
                  </div>
                </div>

                {/* Lista de Nuevos SKUs Sincronizados */}
                {activeTab === 'catalog' && newSkus.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Nuevos SKUs incorporados ({newSkus.length})
                    </h4>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl max-h-36 overflow-y-auto p-2.5 divide-y divide-gray-100">
                      {newSkus.map((sku) => (
                        <div key={sku} className="py-1.5 flex justify-between items-center text-[11px] first:pt-0 last:pb-0">
                          <span className="font-bold text-gray-700">{sku}</span>
                          <span className="text-gray-400 flex items-center gap-0.5">
                            Sincronizado <ArrowRight className="w-3 h-3 text-green-500" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'catalog' && newSkus.length === 0 && (
                  <p className="text-center text-[10px] text-gray-400 py-3 bg-gray-50 rounded-xl border border-dashed">
                    No se encontraron nuevos SKUs para agregar. Todos los productos ya existían y fueron actualizados.
                  </p>
                )}

                {/* Botón para cargar otro */}
                <button 
                  onClick={() => {
                    setStats(null);
                    setSuccessMsg('');
                  }}
                  className="w-full border border-gray-200 hover:bg-gray-50 active:scale-95 text-gray-600 font-bold py-2.5 rounded-xl text-xs transition-all flex justify-center items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Subir otra planilla
                </button>
              </div>
            )}

            {/* Pestaña de Métricas y Analítica */}
            {!loading && activeTab === 'analytics' && (
              <div className="space-y-6">
                {metricsLoading && (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                    <RefreshCw className="w-8 h-8 text-easy-red animate-spin" />
                    <p className="text-xs text-gray-500 font-bold">Generando reportes consolidados...</p>
                  </div>
                )}

                {metricsError && (
                  <div className="bg-red-50 border border-red-200 text-easy-red p-4 rounded-xl text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">Error al cargar métricas:</span>
                      <p className="mt-0.5 text-gray-600">{metricsError}</p>
                      <button onClick={loadMetrics} className="mt-2 text-easy-red underline font-bold active:scale-95 transition-all">Reintentar</button>
                    </div>
                  </div>
                )}

                {!metricsLoading && !metricsError && metrics && (
                  <div className="space-y-6">
                    
                    {/* Resumen en Tarjetas */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-br from-red-50 to-white p-4 rounded-2xl border border-red-100 flex flex-col justify-between shadow-sm">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Ahorro Estimado</span>
                        <div className="mt-1.5 flex items-baseline gap-1 text-easy-red">
                          <span className="text-2xl font-black font-mono">{metrics.resumen.horasAhorradas}</span>
                          <span className="text-[10px] font-extrabold uppercase">horas</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                          <Clock className="w-3.5 h-3.5 text-easy-red" />
                          <span>En pasillo de ventas</span>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-yellow-50 to-white p-4 rounded-2xl border border-yellow-100/55 flex flex-col justify-between shadow-sm">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Fichas Impresas</span>
                        <div className="mt-1.5 flex items-baseline gap-1 text-easy-dark">
                          <span className="text-2xl font-black font-mono">{metrics.resumen.impresiones}</span>
                          <span className="text-[10px] font-extrabold uppercase text-gray-500">carteles</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                          <FileText className="w-3.5 h-3.5 text-yellow-500" />
                          <span>Físicos (Vistas previas: {metrics.resumen.vistasPrevias})</span>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl border border-blue-100 flex flex-col justify-between shadow-sm">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Búsquedas</span>
                        <div className="mt-1.5 flex items-baseline gap-1 text-blue-600">
                          <span className="text-2xl font-black font-mono">{metrics.resumen.busquedas}</span>
                          <span className="text-[10px] font-extrabold uppercase text-blue-500">consultas</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                          <Database className="w-3.5 h-3.5 text-blue-500" />
                          <span>Consultas SAP/EAN</span>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-2xl border border-green-100 flex flex-col justify-between shadow-sm">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Efectividad IA</span>
                        <div className="mt-1.5 flex items-baseline gap-1 text-green-600">
                          <span className="text-2xl font-black font-mono">{metrics.ia.tasaAceptacion}%</span>
                          <span className="text-[10px] font-extrabold uppercase text-green-500">precisión</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                          <Award className="w-3.5 h-3.5 text-green-500" />
                          <span>Borrador aprobado</span>
                        </div>
                      </div>
                    </div>

                    {/* Gráfico/Progreso de Aceptación IA */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <Percent className="w-4 h-4 text-easy-red" />
                          <span className="text-xs font-bold text-gray-700">Conversión de Borradores IA</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-easy-red">{metrics.ia.tasaAceptacion}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-150">
                        <div 
                          className="bg-easy-red h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${metrics.ia.tasaAceptacion}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[9px] font-extrabold uppercase tracking-wider text-gray-400 pt-0.5">
                        <span>Borradores creados: {metrics.ia.draftsCreated}</span>
                        <span>Aprobados por tiendas: {metrics.ia.draftsApproved}</span>
                      </div>
                    </div>

                    {/* Top 10 SKU más demandados */}
                    <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-easy-red" />
                        <span className="text-xs font-bold text-gray-700">Top 10 Productos Demandados</span>
                      </div>
                      <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-100/40 text-[9px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                              <th className="px-4 py-2">SKU</th>
                              <th className="px-4 py-2 text-center">Consultas</th>
                              <th className="px-4 py-2 text-center">Impresiones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 text-[11px]">
                            {metrics.topSkus.length === 0 ? (
                              <tr>
                                <td colSpan="3" className="px-4 py-4 text-center text-gray-400">Sin datos de consultas aún</td>
                              </tr>
                            ) : (
                              metrics.topSkus.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/45">
                                  <td className="px-4 py-2 font-mono font-bold text-gray-600">{item.sku}</td>
                                  <td className="px-4 py-2 text-center font-bold text-gray-700">{item.total}</td>
                                  <td className="px-4 py-2 text-center text-easy-red font-bold">{item.impresiones}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Actividad de Operadores */}
                    <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-easy-red" />
                        <span className="text-xs font-bold text-gray-700">Actividad de Colaboradores</span>
                      </div>
                      <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-100/40 text-[9px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                              <th className="px-4 py-2">Email</th>
                              <th className="px-4 py-2 text-center">Búsquedas</th>
                              <th className="px-4 py-2 text-center">Ediciones</th>
                              <th className="px-4 py-2 text-center">Impresiones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 text-[11px]">
                            {metrics.operadores.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="px-4 py-4 text-center text-gray-400">Sin actividad registrada</td>
                              </tr>
                            ) : (
                              metrics.operadores.map((op, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/45">
                                  <td className="px-4 py-2 font-semibold text-gray-600 max-w-[140px] truncate">{op.email}</td>
                                  <td className="px-4 py-2 text-center font-mono font-semibold text-gray-500">{op.busquedas}</td>
                                  <td className="px-4 py-2 text-center font-mono font-semibold text-gray-500">{op.aprobaciones}</td>
                                  <td className="px-4 py-2 text-center font-mono font-bold text-easy-red">{op.impresiones}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tarjeta de Seguridad */}
                    {metrics.resumen.loginFailed > 0 && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-2xl text-[11px] flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                        <div>
                          <span className="font-bold text-amber-900">Alerta de Seguridad</span>
                          <p className="mt-0.5 text-amber-800/80">
                            Se registraron <strong className="font-bold text-amber-900">{metrics.resumen.loginFailed} intentos de login fallidos</strong>. Podés auditar las IPs de origen directamente desde la tabla `audit_logs` en Supabase.
                          </p>
                        </div>
                      </div>
                    )}
                    
                  </div>
                )}
              </div>
            )}

            {/* Pestaña de Calidad de Catálogo (P1.5) */}
            {!loading && activeTab === 'quality' && (
              <div className="space-y-6">
                {qualityLoading && (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                    <RefreshCw className="w-8 h-8 text-easy-red animate-spin" />
                    <p className="text-xs text-gray-500 font-bold">Analizando calidad de base de datos...</p>
                  </div>
                )}

                {qualityError && (
                  <div className="bg-red-50 border border-red-200 text-easy-red p-4 rounded-xl text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">Error de Calidad:</span>
                      <p className="mt-0.5 text-gray-600">{qualityError}</p>
                      <button onClick={loadQualityData} className="mt-2 text-easy-red underline font-bold active:scale-95 transition-all">Reintentar</button>
                    </div>
                  </div>
                )}

                {!qualityLoading && !qualityError && qualityData && (
                  <div className="space-y-6">
                    
                    {/* Resumen KPIs de Calidad */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-2xl border border-green-100 flex flex-col justify-between shadow-sm">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Fichas Completas</span>
                        <div className="mt-1.5 flex items-baseline gap-1 text-green-600">
                          <span className="text-2xl font-black font-mono">{qualityData.resumen.completas}</span>
                          <span className="text-[10px] font-extrabold uppercase text-green-500">/{qualityData.resumen.totalProductos}</span>
                        </div>
                        <span className="text-[9px] text-gray-400 font-semibold block mt-1.5">Completitud &gt;= 80%</span>
                      </div>

                      <div className="bg-gradient-to-br from-rose-50 to-white p-4 rounded-2xl border border-rose-100 flex flex-col justify-between shadow-sm">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Incompletas / Críticas</span>
                        <div className="mt-1.5 flex items-baseline gap-1 text-rose-600">
                          <span className="text-2xl font-black font-mono">{qualityData.resumen.incompletas}</span>
                          <span className="text-[10px] font-extrabold uppercase text-rose-500">productos</span>
                        </div>
                        <span className="text-[9px] text-rose-500/80 font-bold block mt-1.5">Completitud &lt; 80%</span>
                      </div>

                      <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-2xl border border-amber-100 flex flex-col justify-between shadow-sm">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Sin Foto Oficial</span>
                        <div className="mt-1.5 flex items-baseline gap-1 text-amber-700">
                          <span className="text-2xl font-black font-mono">{qualityData.resumen.sinImagen}</span>
                          <span className="text-[10px] font-extrabold uppercase text-amber-600">artículos</span>
                        </div>
                        <span className="text-[9px] text-gray-400 font-semibold block mt-1.5">Requieren subir imagen</span>
                      </div>

                      <div className="bg-gradient-to-br from-red-50 to-white p-4 rounded-2xl border border-red-100 flex flex-col justify-between shadow-sm">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Inconsistencias</span>
                        <div className="mt-1.5 flex items-baseline gap-1 text-easy-red">
                          <span className="text-2xl font-black font-mono">{qualityData.resumen.totalInconsistencias}</span>
                          <span className="text-[10px] font-extrabold uppercase">alertas</span>
                        </div>
                        <span className="text-[9px] text-easy-red/80 font-bold block mt-1.5">Errores de integridad</span>
                      </div>
                    </div>

                    {/* Desglose de Fichas por Estado */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-3">
                      <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1">
                        <Layers className="w-4 h-4 text-easy-red" />
                        <span>Distribución del Ciclo de Vida</span>
                      </h4>
                      
                      <div className="space-y-2 pt-1.5">
                        {Object.entries(qualityData.estados).map(([est, count]) => {
                          const percentage = qualityData.resumen.totalProductos > 0
                            ? Math.round((count / qualityData.resumen.totalProductos) * 100)
                            : 0;
                          
                          // No listar estados en 0 para no saturar la pantalla colectora
                          if (count === 0 && est !== 'APROBADA' && est !== 'BORRADOR') return null;

                          return (
                            <div key={est} className="space-y-1">
                              <div className="flex justify-between text-[11px] font-semibold text-gray-600">
                                <span>{est}</span>
                                <span className="font-mono text-gray-500">{count} ({percentage}%)</span>
                              </div>
                              <div className="w-full bg-gray-150 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    est === 'APROBADA' ? 'bg-green-500' :
                                    est === 'PENDIENTE_VALIDACION' ? 'bg-blue-500' :
                                    est === 'BORRADOR' || est === 'GENERADA_POR_IA' ? 'bg-orange-500' :
                                    'bg-rose-500'
                                  }`} 
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tabla de Productos que requieren atención */}
                    <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-700">Productos con Alertas / Incompletos</span>
                          <span className="text-[10px] bg-red-50 text-easy-red px-2 py-0.5 rounded-full font-black">Atención: {qualityData.requierenAtencion.length}</span>
                        </div>
                        
                        {/* Filtros locales */}
                        <div className="flex gap-2 mt-1">
                          <select
                            value={filterEstado}
                            onChange={(e) => setFilterEstado(e.target.value)}
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-[10px] font-bold text-gray-600 focus:outline-none focus:ring-1 focus:ring-easy-red"
                          >
                            <option value="ALL">Todos los Estados</option>
                            <option value="SIN_FICHA">Sin Ficha</option>
                            <option value="BORRADOR">Borrador</option>
                            <option value="GENERADA_POR_IA">Borrador IA</option>
                            <option value="PENDIENTE_VALIDACION">Pendiente</option>
                            <option value="OBSERVADA">Observadas</option>
                          </select>

                          <input
                            type="text"
                            placeholder="Buscar SKU..."
                            value={searchTermQuality}
                            onChange={(e) => setSearchTermQuality(e.target.value)}
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-easy-red"
                          />
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-100/40 text-[9px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                              <th className="px-4 py-2">Producto</th>
                              <th className="px-4 py-2 text-center">Completo</th>
                              <th className="px-4 py-2 text-center">Alertas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 text-[11px]">
                            {qualityData.requierenAtencion
                              .filter(item => {
                                if (filterEstado !== 'ALL' && item.estado !== filterEstado) return false;
                                if (searchTermQuality && !item.sku.includes(searchTermQuality)) return false;
                                return true;
                              })
                              .map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/45">
                                  <td className="px-4 py-2.5">
                                    <span className="font-mono font-bold text-gray-600 block">{item.sku}</span>
                                    <span className="text-[10px] text-gray-400 truncate max-w-[150px] block">{item.descripcion}</span>
                                    <span className="text-[8px] bg-gray-100 text-gray-500 font-bold px-1 py-0.5 rounded mt-0.5 inline-block">{item.estado}</span>
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <span className={`font-mono font-bold ${
                                      item.completitud >= 80 ? 'text-green-600' :
                                      item.completitud >= 50 ? 'text-yellow-600' :
                                      'text-rose-600'
                                    }`}>{item.completitud}%</span>
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    {item.inconsistenciasCount > 0 ? (
                                      <span className="text-[10px] bg-red-50 text-easy-red px-1.5 py-0.5 rounded-full font-bold" title={item.inconsistencias.map(i => i.mensaje).join('\n')}>
                                        ⚠️ {item.inconsistenciasCount}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
