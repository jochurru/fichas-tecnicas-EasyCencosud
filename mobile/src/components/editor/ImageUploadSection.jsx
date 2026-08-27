import React, { useState } from 'react';
import { UploadCloud, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

/**
 * @fileoverview Sección con feedback visual interactivo en tiempo real para previsualización,
 * compresión WebP y carga de la fotografía del producto.
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
  const [uploadState, setUploadState] = useState('idle'); // 'idle' | 'reading' | 'compressing' | 'uploading' | 'success' | 'error'
  const [statusMsg, setStatusMsg] = useState('');
  const [errorDetails, setErrorDetails] = useState('');

  const fileInputRef = React.useRef(null);

  const handleImageCompressAndUpload = async (file) => {
    if (!file) return;
    if (setErrorMsg) setErrorMsg('');
    if (setSuccessMsg) setSuccessMsg('');
    setErrorDetails('');

    setUploadState('reading');
    setStatusMsg('Leyendo archivo de imagen...');

    try {
      const reader = new FileReader();

      reader.onload = (event) => {
        setUploadState('compressing');
        setStatusMsg('Optimizando a formato WebP (800x800)...');

        const img = new window.Image();

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
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

            const dataUrl = canvas.toDataURL('image/webp', 0.8);

            setUploadState('uploading');
            setStatusMsg('Subiendo a servidor de almacenamiento...');

            fetch(`${API_BASE_URL}/upload/imagen`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                tipo: 'producto',
                id: sku,
                fileBase64: dataUrl
              })
            })
            .then(async (res) => {
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Error ${res.status} al subir imagen`);
              }
              return res.json();
            })
            .then((data) => {
              if (data.url) {
                setFotoUrl(data.url);
                setUploadState('success');
                setStatusMsg('¡Foto subida y optimizada exitosamente!');
                if (setSuccessMsg) setSuccessMsg('✓ Imagen de producto actualizada y comprimida correctamente.');

                setTimeout(() => {
                  setUploadState('idle');
                  setStatusMsg('');
                }, 4000);
              } else {
                throw new Error('No se obtuvo la URL de la imagen subida.');
              }
            })
            .catch((err) => {
              setUploadState('error');
              const msg = err.message || 'Error al subir la imagen';
              setStatusMsg('Falla en la carga de la foto');
              setErrorDetails(msg);
              if (setErrorMsg) setErrorMsg(msg);
            });
          } catch (canvasErr) {
            setUploadState('error');
            const msg = canvasErr.message || 'Error al comprimir la imagen.';
            setStatusMsg('Error de compresión');
            setErrorDetails(msg);
            if (setErrorMsg) setErrorMsg(msg);
          }
        };

        img.onerror = () => {
          setUploadState('error');
          const msg = 'El archivo seleccionado no se pudo decodificar como imagen.';
          setStatusMsg('Error de formato');
          setErrorDetails(msg);
          if (setErrorMsg) setErrorMsg(msg);
        };

        // Asignar src DESPUÉS de definir onload y onerror
        img.src = event.target.result;
      };

      reader.onerror = () => {
        setUploadState('error');
        const msg = 'Error al leer el archivo del dispositivo.';
        setStatusMsg('Error de lectura');
        setErrorDetails(msg);
        if (setErrorMsg) setErrorMsg(msg);
      };

      // Iniciar lectura DESPUÉS de definir onload y onerror
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadState('error');
      const msg = err.message || 'Error al procesar la imagen';
      setStatusMsg('Error inesperado');
      setErrorDetails(msg);
      if (setErrorMsg) setErrorMsg(msg);
    }
  };

  const isUploading = ['reading', 'compressing', 'uploading'].includes(uploadState);

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-gray-800 text-sm">Fotografía del Producto</h4>
        {uploadState === 'success' && (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5" />
            ¡Subida completada!
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Minivista previa con indicador de carga overlay */}
        <div className={`w-32 h-32 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center p-2 shrink-0 relative transition-all duration-300 ${
          uploadState === 'success' ? 'ring-4 ring-emerald-500/50 border-emerald-500' : ''
        }`}>
          {fotoUrl ? (
            <img src={fotoUrl} alt="Producto" className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="text-center text-gray-400">
              <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
              <span className="text-[10px] font-bold block">Sin Imagen</span>
            </div>
          )}

          {/* Overlay animado durante la carga */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center text-white p-2 text-center rounded-xl animate-fadeIn">
              <Loader2 className="w-7 h-7 animate-spin mb-1 text-blue-400" />
              <span className="text-[10px] font-bold leading-tight">{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Botón interactivo de Carga e Insumos */}
        <div className="flex-1 w-full space-y-2">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className={`text-xs font-bold px-4 py-3 rounded-xl shadow-sm transition-all duration-200 cursor-pointer inline-flex items-center gap-2.5 w-full justify-center sm:w-auto ${
              isUploading
                ? 'bg-blue-600 text-white cursor-not-allowed opacity-90'
                : uploadState === 'success'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : uploadState === 'error'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-easy-dark hover:bg-black text-white active:scale-95'
            }`}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
            ) : uploadState === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            ) : uploadState === 'error' ? (
              <AlertCircle className="w-4 h-4 text-white shrink-0" />
            ) : (
              <UploadCloud className="w-4 h-4 shrink-0" />
            )}

            <span>
              {isUploading
                ? statusMsg
                : uploadState === 'success'
                ? '¡Foto Subida y Optimizada!'
                : uploadState === 'error'
                ? 'Error al subir — Reintentar'
                : 'Subir Nueva Foto (Auto WebP)'}
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            disabled={isUploading}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleImageCompressAndUpload(file);
              }
              e.target.value = ''; // Resetear para permitir volver a subir el mismo archivo si es necesario
            }}
          />

          {/* Banner con detalle del estado inmediato justo debajo del botón */}
          {isUploading && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex items-center gap-2.5 text-blue-900 text-xs font-semibold animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {uploadState === 'success' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2.5 text-emerald-900 text-xs font-bold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>¡Imagen comprimida en WebP y guardada correctamente!</span>
            </div>
          )}

          {uploadState === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-center gap-2.5 text-red-900 text-xs font-semibold animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorDetails || statusMsg}</span>
            </div>
          )}

          <div className="pt-1">
            <label className="text-[10px] font-bold text-gray-500 block mb-1">O pegar URL externa directa</label>
            <input
              type="url"
              placeholder="https://..."
              value={fotoUrl}
              onChange={(e) => setFotoUrl(e.target.value)}
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
