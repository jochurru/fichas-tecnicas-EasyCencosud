import React, { useState } from 'react';
import { UploadCloud, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

/**
 * @fileoverview Sección para previsualización, carga, compresión WebP y confirmación visual inmediata de la foto.
 */

export default function ImageUploadSection({
  sku,
  fotoUrl,
  setFotoUrl,
  sugerenciaImagen,
  setErrorMsg,
  setSuccessMsg,
  token
}) {
  const [uploading, setUploading] = useState(false);
  const [localStatus, setLocalStatus] = useState(null); // null | 'success' | 'error'
  const [statusText, setStatusText] = useState('');

  const handleImageCompressAndUpload = async (file) => {
    if (!file) return;
    if (setErrorMsg) setErrorMsg('');
    if (setSuccessMsg) setSuccessMsg('');
    setUploading(true);
    setLocalStatus(null);
    setStatusText('Comprimiendo y optimizando foto a WebP...');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target.result;
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1000;
            const MAX_HEIGHT = 1000;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/webp', 0.85);
            const activeToken = token || localStorage.getItem('userToken');

            setStatusText('Subiendo a servidor de almacenamiento...');

            fetch(`${API_BASE_URL}/upload/imagen`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${activeToken}`
              },
              body: JSON.stringify({
                tipo: 'producto',
                id: String(sku),
                fileBase64: dataUrl
              })
            })
            .then(async (res) => {
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(data.error || data.message || `Error ${res.status} al subir imagen`);
              }
              return data;
            })
            .then((data) => {
              if (data.url) {
                setFotoUrl(data.url);
                setLocalStatus('success');
                setStatusText('¡Fotografía cargada y optimizada con éxito!');
                if (setSuccessMsg) setSuccessMsg('✓ Imagen de producto actualizada y comprimida correctamente.');
              }
            })
            .catch((err) => {
              console.error('[ImageUpload] Error:', err);
              setLocalStatus('error');
              setStatusText(err.message || 'Error al subir la imagen.');
              if (setErrorMsg) setErrorMsg(err.message || 'Error al subir la imagen');
            })
            .finally(() => {
              setUploading(false);
            });
          } catch (canvasErr) {
            setUploading(false);
            setLocalStatus('error');
            setStatusText('Error al procesar la imagen.');
            if (setErrorMsg) setErrorMsg('Error al procesar la imagen.');
          }
        };
        img.onerror = () => {
          setUploading(false);
          setLocalStatus('error');
          setStatusText('El archivo seleccionado no es una imagen válida.');
          if (setErrorMsg) setErrorMsg('El archivo seleccionado no es una imagen válida.');
        };
      };
      reader.onerror = () => {
        setUploading(false);
        setLocalStatus('error');
        setStatusText('Error al leer el archivo.');
        if (setErrorMsg) setErrorMsg('Error al leer el archivo.');
      };
    } catch (err) {
      setUploading(false);
      setLocalStatus('error');
      setStatusText(err.message || 'Error al procesar el archivo');
      if (setErrorMsg) setErrorMsg(err.message || 'Error al procesar el archivo');
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-gray-800 text-sm">Fotografía del Producto</h4>
        {localStatus === 'success' && (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5" />
            ¡Subida Confirmada!
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Recuadro de previsualización */}
        <div className={`w-32 h-32 rounded-xl bg-gray-100 border overflow-hidden flex items-center justify-center p-2 shrink-0 relative transition-all duration-300 ${
          localStatus === 'success' ? 'ring-4 ring-emerald-500/40 border-emerald-500 bg-white' : 'border-gray-200'
        }`}>
          {fotoUrl ? (
            <img src={fotoUrl} alt="Producto" className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="text-center text-gray-400">
              <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
              <span className="text-[10px] font-bold block">Sin Imagen</span>
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center text-white p-2 text-center rounded-xl">
              <Loader2 className="w-6 h-6 animate-spin mb-1 text-blue-400" />
              <span className="text-[10px] font-bold">{statusText}</span>
            </div>
          )}
        </div>

        {/* Acciones de Carga */}
        <div className="flex-1 w-full space-y-2">
          <label className={`text-xs bg-easy-dark hover:bg-black text-white font-bold px-4 py-3 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer inline-flex items-center gap-2 w-full justify-center sm:w-auto ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <UploadCloud className="w-4 h-4" />}
            <span>{uploading ? 'Subiendo...' : 'Subir Nueva Foto (Auto WebP)'}</span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImageCompressAndUpload(file);
                }
                e.target.value = '';
              }}
            />
          </label>

          {/* Banner de Confirmación Inmediata */}
          {localStatus === 'success' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2 text-emerald-900 text-xs font-bold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusText}</span>
            </div>
          )}

          {/* Banner de Error Inmediato */}
          {localStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-center gap-2 text-red-900 text-xs font-semibold animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{statusText}</span>
            </div>
          )}

          <div className="pt-2">
            <label className="text-[10px] font-bold text-gray-500 block mb-1">O pegar URL externa directa</label>
            <input
              type="url"
              placeholder="https://..."
              value={fotoUrl || ''}
              onChange={(e) => {
                setFotoUrl(e.target.value);
                setLocalStatus(null);
              }}
              className="w-full text-xs font-mono px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-easy-red bg-white"
            />
          </div>
        </div>
      </div>

      {sugerenciaImagen && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
          <strong className="font-semibold block mb-0.5">Sugerencia de búsqueda de imagen:</strong>
          <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 block mt-1 w-fit select-all cursor-pointer">
            {sugerenciaImagen}
          </code>
        </div>
      )}
    </div>
  );
}
