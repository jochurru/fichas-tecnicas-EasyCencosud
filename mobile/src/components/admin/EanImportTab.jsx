import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

/**
 * @fileoverview Sub-pestaña para la importación y actualización masiva de códigos EAN.
 * Con feedback visual de progreso, animación de carga y manejo transparente de errores.
 */

export default function EanImportTab({
  loading,
  setLoading,
  setErrorMsg,
  setSuccessMsg,
  dragActive,
  setDragActive,
  token,
  onTokenExpired
}) {
  const [statusText, setStatusText] = useState('');

  const handleEanUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setStatusText(`Leyendo planilla ${file.name}...`);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileBase64 = e.target.result;
        setStatusText('Enviando registros al servidor...');

        const res = await fetch(`${API_BASE_URL}/catalogos/importar-eans`, {
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
          throw new Error(errData.message || errData.error || `Error ${res.status} al importar EANs`);
        }

        const data = await res.json();
        setLoading(false);
        setStatusText('');
        const actualizados = data.estadisticas?.eansCargados || data.actualizados || data.total || 0;
        setSuccessMsg(`✓ Mapeo de EANs completado: ${actualizados.toLocaleString()} registros procesados exitosamente.`);
        try { if (navigator.vibrate) navigator.vibrate(100); } catch (vErr) {}
      } catch (err) {
        setLoading(false);
        setStatusText('');
        setErrorMsg(err.message || 'Falla al procesar la planilla de EANs.');
      }
    };

    reader.onerror = () => {
      setLoading(false);
      setStatusText('');
      setErrorMsg('Error al leer el archivo Excel.');
    };

    reader.readAsDataURL(file);
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
            handleEanUpload(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => { if (!loading) document.getElementById('eanFileInput')?.click(); }}
      >
        <input 
          id="eanFileInput"
          type="file" 
          accept=".xlsx, .xls"
          className="hidden" 
          disabled={loading}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              const file = e.target.files[0];
              e.target.value = '';
              handleEanUpload(file);
            }
          }}
        />

        {loading ? (
          <div className="py-6 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-10 h-10 text-easy-red animate-spin" />
            <div className="space-y-1">
              <h4 className="font-extrabold text-gray-800 text-sm">Procesando planilla de EANs...</h4>
              <p className="text-xs text-gray-500 font-medium">{statusText || 'Actualizando relaciones en base de datos...'}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-easy-red">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">
              Cargar archivo Excel con mapeo de SKU a EAN (.xlsx / .xls)
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
              Soporta planillas masivas (EAN-SAP.xlsx). Actualizará automáticamente las relaciones para escaneo en tienda.
            </p>
            <span className="inline-flex items-center gap-2 bg-easy-red text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:bg-red-700 transition-all">
              <UploadCloud className="w-4 h-4" /> Seleccionar Planilla
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
