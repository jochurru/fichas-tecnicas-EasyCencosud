import React, { useState } from 'react';
import { 
  X, UploadCloud, AlertCircle, CheckCircle, 
  RefreshCw, FileSpreadsheet, KeyRound, ArrowRight,
  Database, QrCode
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function AdminPanel({ token, onClose }) {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'ean'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [stats, setStats] = useState(null);
  const [newSkus, setNewSkus] = useState([]);
  const [taskProgress, setTaskProgress] = useState(null);

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
          throw new Error('Sesión expirada o privilegios insuficientes. Por favor, vuelve a ingresar.');
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
                setErrorMsg('Sesión expirada durante el procesamiento.');
                setLoading(false);
                setTaskProgress(null);
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

            {/* Selector de Pestañas (Modo de Carga) */}
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
              </div>
            )}

            {/* Zona de Drop para Archivos */}
            {!loading && !stats && (
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
          </div>
        </div>
      </div>
    </div>
  );
}
