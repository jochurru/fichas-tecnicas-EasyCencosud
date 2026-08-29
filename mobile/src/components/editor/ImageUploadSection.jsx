import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

/**
 * @fileoverview Sección limpia y optimizada para la previsualización y carga de fotografías.
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
  const [statusMsg, setStatusMsg] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [previewUrl, setPreviewUrl] = useState(fotoUrl || '');
  const fileInputRef = useRef(null);

  // Sincronizar vista previa si fotoUrl cambia
  useEffect(() => {
    setPreviewUrl(fotoUrl || '');
  }, [fotoUrl]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (setErrorMsg) setErrorMsg('');
    if (setSuccessMsg) setSuccessMsg('');
    setErrorDetails('');
    setUploading(true);
    setStatusMsg('Optimizando imagen...');

    // 1. Mostrar vista previa local instantánea
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // 2. Leer y comprimir a WebP (800x800)
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const base64Data = canvas.toDataURL('image/webp', 0.8);
          setStatusMsg('Subiendo a servidor...');

          const userToken = token || localStorage.getItem('userToken');

          fetch(`${API_BASE_URL}/upload/imagen`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({
              tipo: 'producto',
              id: String(sku),
              fileBase64: base64Data
            })
          })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al subir la imagen');
            return data;
          })
          .then((data) => {
            if (data.url) {
              setPreviewUrl(data.url);
              setFotoUrl(data.url);
              setStatusMsg('¡Foto subida con éxito!');
            }
          })
          .catch((err) => {
            console.error('[ImageUpload] Error:', err);
            setErrorDetails(err.message || 'Error al subir la foto');
          })
          .finally(() => {
            setUploading(false);
          });
        } catch (err) {
          setUploading(false);
          setErrorDetails('Error al procesar el archivo de imagen.');
        }
      };
      img.onerror = () => {
        setUploading(false);
        setErrorDetails('Formato de imagen inválido.');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4 font-sans">
      <h4 className="font-bold text-gray-800 text-sm">Fotografía del Producto</h4>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Recuadro de previsualización */}
        <div className="w-32 h-32 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center p-2 shrink-0 relative">
          {previewUrl ? (
            <img 
              src={previewUrl} 
              alt="Previsualización" 
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-center text-gray-400">
              <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
              <span className="text-[10px] font-bold block">Sin Imagen</span>
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center text-white p-2 text-center rounded-xl">
              <Loader2 className="w-6 h-6 animate-spin mb-1 text-blue-400" />
              <span className="text-[10px] font-bold leading-tight">{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Acciones de carga */}
        <div className="flex-1 w-full space-y-2">
          <label className={`w-full sm:w-auto text-xs font-bold px-4 py-3 rounded-xl bg-easy-dark text-white hover:bg-black transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer select-none ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" /> : <UploadCloud className="w-4 h-4 shrink-0" />}
            <span>{uploading ? statusMsg : 'Subir Nueva Foto (Auto WebP)'}</span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>

          {errorDetails && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-2 flex items-center gap-2 text-red-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorDetails}</span>
            </div>
          )}

          <div className="pt-1">
            <label className="text-[10px] font-bold text-gray-500 block mb-1">O pegar URL externa directa</label>
            <input
              type="url"
              placeholder="https://..."
              value={fotoUrl || ''}
              onChange={(e) => {
                setFotoUrl(e.target.value);
                setPreviewUrl(e.target.value);
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
