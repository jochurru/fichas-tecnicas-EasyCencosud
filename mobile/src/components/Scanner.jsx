import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, QrCode, Eye, Plus, ShieldCheck, Check } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { getProduct, saveProduct, savePrintQueueItem } from '../lib/indexedDb';
import FichaPreviewModal from './FichaPreviewModal';

export default function Scanner({ token, onScanSuccess, onClose }) {
  const html5QrcodeRef = useRef(null);
  
  // Estados para modo continuo y analíticas locales
  const [isContinuous, setIsContinuous] = useState(false);
  const [lastScans, setLastScans] = useState([]); // Últimos 5 productos detectados
  const [toastItem, setToastItem] = useState(null); // Producto cargando/resuelto en el toast activo
  const [toastLoading, setToastLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState(null); // Ítem para previsualización a escala física

  // Registros de control para deduplicación temporal (evitar capturas duplicadas en modo continuo)
  const cooldownsRef = useRef({});

  // Sintetizador nativo de audio (beep corto)
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const context = new AudioCtx();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      oscillator.frequency.setValueAtTime(900, context.currentTime); // Tono de 900Hz
      gainNode.gain.setValueAtTime(0.08, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
      
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
    } catch (e) {
      console.warn('[Scanner] Web Audio Beep falló o no está soportado:', e);
    }
  };

  // Haptic feedback (Vibración)
  const triggerHaptic = () => {
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  };

  // Resolución y agregado automático en segundo plano
  const handleDetectedCode = async (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    // Control de Cooldown (2.5s por código para evitar loops de rebote)
    const now = Date.now();
    const lastSeen = cooldownsRef.current[cleanCode] || 0;
    if (now - lastSeen < 2500) {
      return; // Ignorar lectura redundante
    }
    cooldownsRef.current[cleanCode] = now;

    // Alertas de detección inmediata
    playBeep();
    triggerHaptic();

    if (!isContinuous) {
      // Flujo individual clásico: Apagar cámara y retornar
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop().then(() => {
          onScanSuccess(cleanCode);
        }).catch(err => {
          console.error("Error al detener cámara en éxito clásico:", err);
          onScanSuccess(cleanCode);
        });
      } else {
        onScanSuccess(cleanCode);
      }
      return;
    }

    // FLUJO MODO CONTINUO (RÁFAGA)
    console.log(`[Modo Continuo] Resolviendo código: ${cleanCode}`);
    setToastLoading(true);
    setToastItem({ sku: cleanCode, descripcion: 'Buscando producto...', loading: true });

    try {
      let productData = null;

      // 1. Intentar resolver local offline primero (IndexedDB)
      const cached = await getProduct(cleanCode);
      if (cached) {
        productData = cached;
        console.log(`[Modo Continuo] ✓ Resuelto desde IndexedDB offline:`, productData.producto.sku);
      } else {
        // 2. Fetch en segundo plano
        const res = await fetch(`${API_BASE_URL}/producto/${cleanCode}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          productData = await res.json();
          // Guardar en IndexedDB para disponibilidad offline posterior
          await saveProduct(productData);
        }
      }

      if (productData && productData.producto) {
        const item = {
          sku: productData.producto.sku,
          descripcion: productData.producto.descripcion,
          foto_url: productData.ficha_tecnica?.foto_url || '',
          marca: productData.ficha_tecnica?.especificaciones_json?.marca || 'GENERICA',
          tipo_herramienta: productData.ficha_tecnica?.especificaciones_json?.tipo_herramienta || 'HERRAMIENTA',
          especificaciones_json: productData.ficha_tecnica?.especificaciones_json || {},
          template: 'fleje3', // Plantilla por defecto al agregar a la cola
          cantidad: 1
        };

        // Colocar item en el Toast Flotante
        setToastItem(item);
        
        // Agregar al historial de los últimos 5 escaneos
        setLastScans(prev => {
          const filtered = prev.filter(x => x.sku !== item.sku);
          return [item, ...filtered].slice(0, 5);
        });
      } else {
        setToastItem({
          sku: cleanCode,
          descripcion: 'El producto no existe en el catálogo maestro SAP.',
          error: true
        });
      }
    } catch (err) {
      console.error('[Modo Continuo] Error al resolver:', err);
      setToastItem({
        sku: cleanCode,
        descripcion: 'Error de conexión con el servidor local.',
        error: true
      });
    } finally {
      setToastLoading(false);
      // Auto-ocultar toast después de 4.5 segundos si no interactúan
      setTimeout(() => {
        setToastItem(current => {
          if (current && (current.sku === cleanCode || current.loading)) {
            return null;
          }
          return current;
        });
      }, 4500);
    }
  };

  useEffect(() => {
    const scannerId = "reader";
    const html5Qrcode = new Html5Qrcode(scannerId);
    html5QrcodeRef.current = html5Qrcode;

    const config = { 
      fps: 15, 
      qrbox: (width, height) => {
        const boxWidth = Math.min(width * 0.85, 300);
        const boxHeight = 110;
        return { x: (width - boxWidth) / 2, y: (height - boxHeight) / 2, width: boxWidth, height: boxHeight };
      },
      aspectRatio: 1.0
    };

    html5Qrcode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        handleDetectedCode(decodedText);
      },
      (errorMessage) => {
        // Ignorar frames sin código
      }
    ).catch(err => {
      console.error("Error al iniciar la cámara del dispositivo:", err);
    });

    return () => {
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop().catch(err => console.error("Error al limpiar cámara en unmount:", err));
      }
    };
  }, [isContinuous]); // Se reinicia el escáner si cambia el modo para refrescar los callbacks correctamente

  // Agregar item del Toast a la Cola de Impresión
  const handleAddToQueue = async () => {
    if (!toastItem || toastItem.loading || toastItem.error || toastItem.added) return;
    
    await savePrintQueueItem(toastItem);
    
    // Vibración de confirmación
    triggerHaptic();

    // Mostrar estado de confirmación verde
    setToastItem(prev => ({ ...prev, added: true }));
    
    // Disparar evento global para actualizar componentes y Drawer
    window.dispatchEvent(new Event('print-queue-updated'));
    
    // Ocultar toast de confirmación suavemente tras 1.4s
    setTimeout(() => {
      setToastItem(current => (current && current.added ? null : current));
    }, 1400);
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col justify-between p-5 pb-6">
      
      {/* Controles de Cabecera */}
      <div className="flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-easy-yellow animate-pulse shrink-0" />
          <div>
            <h3 className="font-bold text-sm leading-none">Visor de Escaneo</h3>
            <span className="text-[9px] text-gray-400 font-semibold block uppercase mt-0.5">Captura Automática</span>
          </div>
        </div>
        
        {/* Toggle Modo Continuo P1.19 */}
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/10 select-none">
          <span className="text-[10px] font-black uppercase text-gray-300">Modo Continuo</span>
          <button
            onClick={() => {
              setIsContinuous(!isContinuous);
              setToastItem(null);
            }}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors relative ${
              isContinuous ? 'bg-easy-yellow' : 'bg-gray-600'
            }`}
          >
            <div 
              className={`w-4 h-4 rounded-full bg-white transition-all shadow-md transform ${
                isContinuous ? 'translate-x-4' : 'translate-x-0'
              }`}
            ></div>
          </button>
        </div>

        <button 
          onClick={onClose} 
          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-transform"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Visor de Cámara */}
      <div className="flex-1 flex items-center justify-center relative my-3">
        <div id="reader" className="w-full max-w-sm overflow-hidden rounded-2xl border-2 border-dashed border-easy-yellow/60 bg-gray-950"></div>
        <div className="absolute left-1/2 top-1/2 w-[72%] h-[2.5px] bg-easy-red -translate-x-1/2 -translate-y-1/2 shadow-[0_0_12px_rgba(227,6,19,0.9)] animate-pulse pointer-events-none"></div>

        {/* Toast Flotante Inferior P1.19 / P1.24 */}
        {toastItem && (
          <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm border border-gray-100 rounded-2xl p-3 shadow-2xl flex items-center gap-3 animate-fade-in text-left">
            {toastItem.foto_url && (
              <div className="w-11 h-11 bg-white border border-gray-100 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                <img src={toastItem.foto_url} alt="" className="max-w-full max-h-full object-contain" />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <span className="font-mono font-bold text-gray-700 text-[10px] block leading-none">SAP {toastItem.sku}</span>
              <p className="text-[10px] text-gray-600 font-semibold truncate leading-snug mt-1.5">
                {toastItem.descripcion}
              </p>
            </div>

            {/* Acciones Rápidas */}
            <div className="flex flex-col gap-1 shrink-0">
              {!toastItem.loading && !toastItem.error && (
                <>
                  {toastItem.added ? (
                    <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-1.5 rounded-lg flex items-center gap-1 shadow-sm animate-pulse">
                      <Check className="w-3 h-3 text-white" /> Agregado
                    </span>
                  ) : (
                    <button
                      onClick={handleAddToQueue}
                      className="bg-easy-red hover:bg-red-700 text-white text-[9px] font-black uppercase px-2 py-1.5 rounded-lg active:scale-95 transition-all flex items-center gap-1 shadow-sm"
                    >
                      <Plus className="w-3 h-3" /> Cola
                    </button>
                  )}
                  <button
                    onClick={() => setPreviewItem(toastItem)}
                    className="bg-gray-800 hover:bg-gray-700 text-white text-[9px] font-black uppercase px-2 py-1.5 rounded-lg active:scale-95 transition-all flex items-center gap-1 shadow-sm"
                  >
                    <Eye className="w-3 h-3" /> Ver
                  </button>
                </>
              )}
              {toastItem.loading && (
                <RefreshCw className="w-4 h-4 text-easy-red animate-spin mx-auto" />
              )}
              {toastItem.error && (
                <span className="text-[8px] bg-red-100 text-easy-red px-1.5 py-1 rounded font-bold uppercase">Error</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Historial Horizontal Inferior P1.20 */}
      <div className="space-y-2">
        {lastScans.length > 0 && (
          <div>
            <span className="text-gray-400 text-[9px] font-bold uppercase tracking-wider block mb-1.5 text-left">Últimos 5 detectados</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {lastScans.map((item, idx) => (
                <div 
                  key={idx} 
                  className="bg-white/10 backdrop-blur-sm border border-white/5 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shrink-0 max-w-[125px] select-none"
                >
                  <div className="w-6 h-6 bg-white rounded-md overflow-hidden flex items-center justify-center shrink-0">
                    <img src={item.foto_url || 'https://placehold.co/40?text=S/F'} alt="" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="text-left truncate min-w-0">
                    <span className="font-mono font-bold text-[8px] text-gray-300 block leading-none">{item.sku}</span>
                    <span className="text-[7.5px] text-gray-400 font-semibold truncate block mt-0.5">{item.descripcion}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center pt-1 border-t border-white/5">
          <p className="text-gray-400 text-[10px] font-medium leading-relaxed">
            {isContinuous 
              ? 'El visor continuará escaneando. Toca "Cola" o "Ver" en los carteles detectados.' 
              : 'La cámara apagará el sensor de forma inmediata al detectar el código de barras.'
            }
          </p>
        </div>
      </div>

      {/* Modal del Previsualizador Físico P1.24 */}
      {previewItem && (
        <FichaPreviewModal
          sku={previewItem.sku}
          currentSpecs={{
            marca: previewItem.marca,
            tipo_herramienta: previewItem.tipo_herramienta,
            especificaciones: previewItem.especificaciones_json?.especificaciones || []
          }}
          currentFotoUrl={previewItem.foto_url}
          templateName="fleje3"
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
