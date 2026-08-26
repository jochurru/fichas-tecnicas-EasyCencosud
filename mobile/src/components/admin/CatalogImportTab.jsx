import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, RefreshCw, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

/**
 * @fileoverview Sub-pestaña para la importación masiva del catálogo SAP vía Excel.
 * Maneja arrastrar y soltar (drag & drop), selección de archivo, monitoreo de progreso y pantalla de carga.
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
  newSkus,
  token,
  onTokenExpired
}) {
  const [statusText, setStatusText] = useState('');

  const handleFileUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setTaskProgress(null);
    setStatusText(`Leyendo planilla ${file.name}...`);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileBase64 = e.target.result;
        setStatusText('Enviando catálogo al servidor...');

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
        
        // Si es procesamiento asincrónico por tarea
        if (data.taskId) {
          setStatusText('Procesando productos en segundo plano...');
          setTaskProgress({ status: 'PROCESSING', progress: 0, total: 0 });
          pollTaskStatus(data.taskId);
        } else {
          setLoading(false);
          setStatusText('');
          const total = data.estadisticas?.totalProcesados || data.procesados || 0;
          setSuccessMsg(`✓ Catálogo SAP importado exitosamente: ${total.toLocaleString()} SKUs procesados.`);
        }
      } catch (err) {
        setLoading(false);
        setStatusText('');
        setErrorMsg(err.message || 'Error al procesar el archivo Excel.');
      }
    };

    reader.onerror = () => {
      setLoading(false);
      setStatusText('');
      setErrorMsg('Error al leer el archivo Excel.');
    };

    reader.readAsDataURL(file);
  };

  const pollTaskStatus = (taskId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/catalogos/tareas/${taskId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const task = await res.json();
        setTaskProgress(task);

        if (task.status === 'COMPLETED') {
          clearInterval(interval);
          setLoading(false);
          setStatusText('');
          const total = task.result?.totalProcesados || task.result?.procesados || 0;
          setSuccessMsg(`✓ Importación de catálogo SAP finalizada: ${total.toLocaleString()} registros procesados.`);
        } else if (task.status === 'FAILED') {
          clearInterval(interval);
          setLoading(false);
          setStatusText('');
          setErrorMsg(task.error || 'La tarea de importación de catálogo falló.');
        }
      } catch (err) {
        console.error('Error al verificar estado de tarea:', err);
      }
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div 
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all bg-gray-50/50 hover:bg-gray-50 overflow-hidden ${
          loading ? 'pointer-events-none opacity-80 border-easy-red' : dragActive ? 'border-easy-red bg-red-50/20' : 'border-gray-200 cursor-pointer'
        }`}
        onDragOver={(e) => { e.preventDefault(); if (!loading) setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (!loading && e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => { if (!loading) document.getElementById('cat-upload-input')?.click(); }}
      >
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          className="hidden" 
          id="cat-upload-input"
          disabled={loading}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              const file = e.target.files[0];
              e.target.value = '';
              handleFileUpload(file);
            }
          }}
        />
        
        {loading ? (
          <div className="py-6 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-10 h-10 text-easy-red animate-spin" />
            <div className="space-y-1">
              <h4 className="font-extrabold text-gray-800 text-sm">Importando Catálogo SAP...</h4>
              <p className="text-xs text-gray-500 font-medium">{statusText || 'Procesando registros de productos...'}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-red-100/60 text-easy-red flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <span className="font-bold text-gray-800 text-sm mb-1">
              Arrastrá acá tu archivo Excel SAP (.xlsx / .xls) o hacé clic para buscar
            </span>
            <span className="text-xs text-gray-400 font-medium max-w-sm mx-auto">
              Soporta planillas maestras ZMA con columnas de Material/SKU, Texto Breve, Grupo de Artículos y Proveedor
            </span>
          </div>
        )}
      </div>

      {/* Progreso de importación en segundo plano */}
      {taskProgress && taskProgress.status === 'PROCESSING' && (
        <div className="bg-blue-50 border border-blue-150 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-blue-900">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              Procesando catálogo en segundo plano...
            </span>
            <span>{taskProgress.progress || 0}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${taskProgress.progress || 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
