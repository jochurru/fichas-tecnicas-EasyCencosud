import React from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { API_BASE_URL } from '../../config';

/**
 * @fileoverview Sub-pestaña para la importación y actualización masiva de códigos EAN.
 */

export default function EanImportTab({
  setLoading,
  setErrorMsg,
  setSuccessMsg,
  dragActive,
  setDragActive,
  token,
  onTokenExpired
}) {
  const handleEanUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileBase64 = e.target.result;

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
        setSuccessMsg(`✓ Mapeo de EANs completado: ${data.actualizados || data.total || 0} registros procesados exitosamente.`);
        try { if (navigator.vibrate) navigator.vibrate(100); } catch (vErr) {}
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
            handleEanUpload(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => document.getElementById('eanFileInput').click()}
      >
        <input 
          id="eanFileInput"
          type="file" 
          accept=".xlsx, .xls"
          className="hidden" 
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleEanUpload(e.target.files[0]);
            }
          }}
        />

        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-easy-red">
          <FileSpreadsheet className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-gray-800 mb-1">
          Cargar archivo Excel con mapeo de SKU a EAN (.xlsx)
        </h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
          Actualizará automáticamente la relación de EANs para lectura con escáner de barras
        </p>
        <span className="inline-flex items-center gap-2 bg-easy-red text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:bg-red-700 transition-all">
          <UploadCloud className="w-4 h-4" /> Seleccionar Planilla
        </span>
      </div>
    </div>
  );
}
