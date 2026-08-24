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

    const formData = new FormData();
    formData.append('archivo', file);

    try {
      const res = await fetch(`${API_BASE_URL}/catalogos/importar-eans`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        if (res.status === 401 && onTokenExpired) onTokenExpired();
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status} al importar EANs`);
      }

      const data = await res.json();
      setLoading(false);
      setSuccessMsg(`✓ Mapeo de EANs completado: ${data.actualizados || 0} registros actualizados.`);
      try { if (navigator.vibrate) navigator.vibrate(100); } catch (vErr) {}
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
            handleEanUpload(e.dataTransfer.files[0]);
          }
        }}
      >
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          className="hidden" 
          id="ean-upload-input"
          onChange={(e) => handleEanUpload(e.target.files[0])}
        />
        <label htmlFor="ean-upload-input" className="cursor-pointer flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-blue-100/60 text-blue-600 flex items-center justify-center mb-3">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <span className="font-bold text-gray-800 text-sm mb-1">
            Cargar archivo Excel con mapeo de SKU a EAN (.xlsx)
          </span>
          <span className="text-xs text-gray-400 font-medium">
            Actualizará automáticamente la relación de EANs para lectura con escáner de barras
          </span>
        </label>
      </div>
    </div>
  );
}
