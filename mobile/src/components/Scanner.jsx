import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

export default function Scanner({ onScanSuccess, onClose }) {
  const html5QrcodeRef = useRef(null);

  useEffect(() => {
    const scannerId = "reader";
    const html5Qrcode = new Html5Qrcode(scannerId);
    html5QrcodeRef.current = html5Qrcode;

    const config = { 
      fps: 15, 
      qrbox: (width, height) => {
        // Caja de escaneo optimizada para códigos de barra (EAN-13 es alargado)
        const boxWidth = Math.min(width * 0.85, 300);
        const boxHeight = 110;
        return { x: (width - boxWidth) / 2, y: (height - boxHeight) / 2, width: boxWidth, height: boxHeight };
      },
      aspectRatio: 1.0
    };

    html5Qrcode.start(
      { facingMode: "environment" }, // Cámara trasera por defecto
      config,
      (decodedText) => {
        console.log(`Código EAN escaneado con éxito: ${decodedText}`);
        html5Qrcode.stop().then(() => {
          onScanSuccess(decodedText);
        }).catch(err => {
          console.error("Error al apagar cámara en éxito:", err);
          onScanSuccess(decodedText);
        });
      },
      (errorMessage) => {
        // Ignorar errores repetidos mientras busca en los frames
      }
    ).catch(err => {
      console.error("Error al iniciar la cámara del dispositivo:", err);
    });

    return () => {
      // Cleanup: Asegurar que se detenga la cámara al desmontar
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop().catch(err => console.error("Error al limpiar cámara en unmount:", err));
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col justify-between p-6 pb-8">
      <div className="flex justify-between items-center text-white">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Camera className="w-5 h-5 text-easy-yellow animate-pulse" /> Escaneo EAN-13
        </h3>
        <button 
          onClick={onClose} 
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-transform"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center relative my-4">
        {/* Div contenedor de la cámara */}
        <div id="reader" className="w-full max-w-sm overflow-hidden rounded-xl border-2 border-dashed border-easy-yellow/80 bg-gray-950"></div>
        
        {/* Línea guía láser para enfocar el código */}
        <div className="absolute left-1/2 top-1/2 w-[70%] h-[3px] bg-easy-red -translate-x-1/2 -translate-y-1/2 shadow-[0_0_12px_rgba(227,6,19,0.9)] animate-pulse pointer-events-none"></div>
      </div>

      <div className="text-center">
        <p className="text-gray-300 text-sm font-medium mb-1">Colocá el código de barras en el recuadro</p>
        <p className="text-gray-500 text-xs px-6">La cámara ajustará el enfoque y capturará el código de barras automáticamente.</p>
      </div>
    </div>
  );
}
