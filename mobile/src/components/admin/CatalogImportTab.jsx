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

    const formData = new FormData();
    formData.append('archivo', file);

    try {
      const res = await fetch(`${API_BASE_URL}/catalogos/importar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        if (res.status === 401 && onTokenExpired) onTokenExpired();
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status} al subir archivo`);
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
              
              if (taskData.status === 'completed') {
                clearInterval(pollInterval);
                setLoading(false);
                setSuccessMsg('¡Catálogo SAP importado y sincronizado correctamente!');
                try { if (navigator.vibrate) navigator.vibrate(100); } catch (vErr) {}
              } else if (taskData.status === 'failed') {
                clearInterval(pollInterval);
                setLoading(false);
                setErrorMsg(`Error en la tarea: ${taskData.error || 'Fallo desconocido'}`);
              }
            }
          } catch (pErr) {
            console.error('Error al monitorear tarea:', pErr);
          }
        }, 2000);
      } else {
        setLoading(false);
        setSuccessMsg('¡Catálogo SAP importado correctamente!');
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message);
    }
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
      >
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          className="hidden" 
          id="cat-upload-input"
          onChange={(e) => handleFileUpload(e.target.files[0])}
        />
        <label htmlFor="cat-upload-input" className="cursor-pointer flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-red-100/60 text-easy-red flex items-center justify-center mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>
          <span className="font-bold text-gray-800 text-sm mb-1">
            Arrastrá acá tu archivo Excel SAP (.xlsx) o hacé clic para buscar
          </span>
          <span className="text-xs text-gray-400 font-medium">
            Soporta planillas maestras con columnas de SKU, Descripción, Marca y Proveedor
          </span>
        </label>
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
              style={{ width: `${(taskProgress.processedRows / (taskProgress.totalRows || 1)) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
