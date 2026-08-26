import React from 'react';
import { UploadCloud, FileSpreadsheet, RefreshCw, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

/**
 * @fileoverview Sub-pestaña para la importación masiva del catálogo SAP vía Excel.
 * Maneja arrastrar y soltar (drag & drop), selección de archivo y monitoreo de progreso.
 */

export default function CatalogImportTab({
  loading,
  setLoading,
  setErrorMsg,
  setSuccessMsg,
  dragActive,
  setDragActive,
  taskProgress,
  setTaskProgress,
  stats,
  newSkus,
  token,
  onTokenExpired
}) {
  const handleFileUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setTaskProgress(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileBase64 = e.target.result;

        const res = await fetch(`${API_BASE_URL}/catalogos/importar`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ fileBase64 })
        });

        if (!res.ok) {
          if (res.status === 401 && onTokenExpired) onTokenExpired();
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || `Error ${res.status} al subir archivo`);
        }

        const data = await res.json();

        if (data.async && data.taskId) {
          setSuccessMsg(`✓ Proceso iniciado en segundo plano (ID: ${data.taskId}). Monitoreando progreso...`);
          
          const pollInterval = setInterval(async () => {
            try {
              const progressRes = await fetch(`${API_BASE_URL}/catalogos/tareas/${data.taskId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              if (progressRes.ok) {
                const taskData = await progressRes.json();
                setTaskProgress(taskData);
                if (taskData.estado === 'COMPLETADO' || taskData.estado === 'ERROR') {
                  clearInterval(pollInterval);
                  setLoading(false);
                  if (taskData.estado === 'COMPLETADO') {
                    setSuccessMsg(`✓ Importación completada: ${taskData.resultado?.nuevosCount || 0} nuevos productos procesados.`);
                  } else {
                    setErrorMsg(`Error en la tarea: ${taskData.error || 'Fallo desconocido'}`);
                  }
                }
              }
            } catch (pErr) {
              console.error('Error al consultar estado de tarea:', pErr);
            }
          }, 2000);
        } else {
          setLoading(false);
          setSuccessMsg(`✓ Importación completada: ${data.nuevosCount || 0} nuevos productos creados.`);
          try { if (navigator.vibrate) navigator.vibrate(100); } catch (vErr) {}
        }
      } catch (err) {
        setLoading(false);
        setErrorMsg(err.message);
      }
    };

    reader.onerror = () => {
      setLoading(false);
      setErrorMsg('Error al leer el archivo Excel.');
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div 
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer bg-gray-50/50 hover:bg-gray-50 ${
          dragActive ? 'border-easy-red bg-red-50/20' : 'border-gray-200'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => document.getElementById('cat-upload-input')?.click()}
      >
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          className="hidden" 
          id="cat-upload-input"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              const file = e.target.files[0];
              e.target.value = '';
              handleFileUpload(file);
            }
          }}
        />
        <div className="flex flex-col items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-red-100/60 text-easy-red flex items-center justify-center mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>
          <span className="font-bold text-gray-800 text-sm mb-1">
            Arrastrá acá tu archivo Excel SAP (.xlsx) o hacé clic para buscar
          </span>
          <span className="text-xs text-gray-400 font-medium">
            Soporta planillas maestras con columnas de SKU, Descripción, Marca y Proveedor
          </span>
        </div>
      </div>

      {/* Progreso de importación en segundo plano */}
      {taskProgress && (
        <div className="bg-blue-50 border border-blue-150 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center text-xs font-bold text-blue-900">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              Procesando filas del catálogo... ({taskProgress.processedRows} de {taskProgress.totalRows})
            </span>
            <span>{Math.round((taskProgress.processedRows / (taskProgress.totalRows || 1)) * 100)}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${Math.round((taskProgress.processedRows / (taskProgress.totalRows || 1)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Métricas y resumen */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
            <div className="text-xl font-extrabold text-gray-800">{stats.totalExistentes || 0}</div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Existentes</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
            <div className="text-xl font-extrabold text-emerald-700">{stats.nuevosAgregados || 0}</div>
            <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">Nuevos Creados</div>
          </div>
        </div>
      )}

      {/* Lista de nuevos SKUs agregados */}
      {newSkus && newSkus.length > 0 && (
        <div className="bg-white border border-gray-150 rounded-2xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Nuevos SKUs incorporados ({newSkus.length})
          </h4>
          <div className="max-h-32 overflow-y-auto divide-y divide-gray-100 text-xs">
            {newSkus.map((item, idx) => (
              <div key={idx} className="py-1.5 flex justify-between items-center text-gray-600">
                <span className="font-mono font-bold text-gray-800">{item.sku}</span>
                <span className="truncate max-w-[200px] text-gray-500 text-[11px]">{item.descripcion}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
