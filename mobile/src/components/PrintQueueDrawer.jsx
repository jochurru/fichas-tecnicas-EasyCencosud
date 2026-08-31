import React, { useState, useEffect } from 'react';
import { Printer, X, Trash2, Plus, Minus, Eye, RefreshCw, FileText, CheckCircle2, Check } from 'lucide-react';
import { getPrintQueue, savePrintQueueItem, removePrintQueueItem, clearPrintQueue } from '../lib/indexedDb';
import { API_BASE_URL } from '../config';
import FichaPreviewModal from './FichaPreviewModal';

export default function PrintQueueDrawer({ token, onPrintSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [showClearToast, setShowClearToast] = useState(false);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState(null);

  // Cargar cola desde IndexedDB al iniciar y al abrir el cajón
  const loadQueue = async () => {
    const items = await getPrintQueue();
    setQueue(items || []);
  };

  useEffect(() => {
    loadQueue();
    // Suscribirse a un evento personalizado para recargar la cola si se agregan cosas desde otras pantallas
    const handleQueueChange = () => loadQueue();
    window.addEventListener('print-queue-updated', handleQueueChange);
    return () => window.removeEventListener('print-queue-updated', handleQueueChange);
  }, []);

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      loadQueue();
    }
  };

  // Ajustar cantidad de copias
  const handleUpdateQty = async (sku, delta) => {
    const item = queue.find(i => i.sku === sku);
    if (!item) return;

    const newQty = Math.max(1, (item.cantidad || 1) + delta);
    const updatedItem = { ...item, cantidad: newQty };
    
    await savePrintQueueItem(updatedItem);
    loadQueue();
  };

  // Cambiar plantilla de un ítem
  const handleUpdateTemplate = async (sku, template) => {
    const item = queue.find(i => i.sku === sku);
    if (!item) return;

    const updatedItem = { ...item, template };
    await savePrintQueueItem(updatedItem);
    loadQueue();
  };

  // Aplicar plantilla a todos
  const handleApplyTemplateToAll = async (template) => {
    for (const item of queue) {
      await savePrintQueueItem({ ...item, template });
    }
    loadQueue();
  };

  // Eliminar un ítem
  const handleRemove = async (sku) => {
    await removePrintQueueItem(sku);
    loadQueue();
  };

  // Vaciar la cola (Sin confirmaciones bloqueantes)
  const handleClearAll = async () => {
    await clearPrintQueue();
    loadQueue();
    setIsOpen(false);
    
    // Alertas táctiles
    try {
      if (navigator.vibrate) {
        navigator.vibrate(40);
      }
    } catch (e) {}

    // Mostrar Toast flotante inferior por 2 segundos
    setShowClearToast(true);
    setTimeout(() => {
      setShowClearToast(false);
    }, 2000);
  };

  // Despachar lote para impresión
  const handlePrintBatch = async () => {
    if (queue.length === 0) return;
    setLoading(true);

    try {
      const payload = {
        items: queue.map(i => ({
          sku: i.sku,
          template: i.template || 'fleje3',
          cantidad: i.cantidad || 1
        }))
      };

      const response = await fetch(`${API_BASE_URL}/fichas/imprimir-lote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = 'Error al generar el PDF del lote';
        try {
          const errJson = JSON.parse(errorText);
          errorMsg = errJson.error || errorMsg;
        } catch (e) {
          errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      // Descargar el PDF retornado
      const blob = await response.blob();
      const fileUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = fileUrl;

      // Generar timestamp con fecha y hora local: lote_impresion_YYYY-MM-DD_HH-mm-ss.pdf
      const now = new Date();
      const YYYY = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const DD = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${YYYY}-${MM}-${DD}_${hh}-${mm}-${ss}`;

      const filename = `lote_impresion_${timestamp}.pdf`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      // Limpiar cola local
      await clearPrintQueue();
      loadQueue();
      setIsOpen(false);
      
      // Disparar Notificación de Descarga Global
      window.dispatchEvent(new CustomEvent('pdf-downloaded', {
        detail: {
          url: fileUrl,
          blob,
          filename,
          title: `Lote de Impresión (${totalLabelsCount} etiquetas)`
        }
      }));

      if (onPrintSuccess) {
        onPrintSuccess();
      }
    } catch (err) {
      console.error(err);
      alert('Error en impresión por lote: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalLabelsCount = queue.reduce((acc, curr) => acc + (curr.cantidad || 1), 0);

  if (queue.length === 0 && !isOpen) {
    return null;
  }

  return (
    <>
      {/* Contenedor flotante alineado con el layout centrado del smartphone */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 max-w-md w-full px-5 flex justify-end z-40 pointer-events-none">
        <button
          onClick={toggleDrawer}
          className="pointer-events-auto w-14 h-14 bg-easy-red hover:bg-red-700 text-white rounded-full shadow-2xl shadow-easy-red/35 flex items-center justify-center active:scale-95 hover:scale-105 transition-all duration-200 select-none relative"
        >
          <Printer className="w-6 h-6 text-white" />
          {queue.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-white text-easy-red text-[10px] font-black rounded-full h-5.5 w-5.5 flex items-center justify-center shadow-lg border border-red-150 animate-bounce">
              {totalLabelsCount}
            </span>
          )}
        </button>
      </div>

      {/* Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          {/* Backdrop Cierre */}
          <div className="flex-1" onClick={toggleDrawer}></div>

          {/* Panel Lateral deslizable */}
          <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl relative animate-slide-in">
            {/* Cabecera del Drawer */}
            <div className="px-5 py-4 border-b border-gray-150 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-easy-red" />
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">Cola de Impresión</h3>
                  <p className="text-[10px] text-gray-400 font-semibold">{queue.length} productos / {totalLabelsCount} carteles acumulados</p>
                </div>
              </div>
              <button 
                onClick={toggleDrawer}
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Listado de la cola */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              
              {/* Opciones globales si hay ítems */}
              {queue.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex justify-between items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Plantilla global:</span>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => handleApplyTemplateToAll('fleje3')}
                      className="px-2.5 py-1 bg-white hover:bg-gray-150 border border-gray-200 text-[9px] font-black rounded-lg text-gray-600 active:scale-95 transition-all"
                    >
                      Fleje 3
                    </button>
                    <button 
                      onClick={() => handleApplyTemplateToAll('fleje2')}
                      className="px-2.5 py-1 bg-white hover:bg-gray-150 border border-gray-200 text-[9px] font-black rounded-lg text-gray-600 active:scale-95 transition-all"
                    >
                      Fleje 2
                    </button>
                    <button 
                      onClick={() => handleApplyTemplateToAll('a4')}
                      className="px-2.5 py-1 bg-white hover:bg-gray-150 border border-gray-200 text-[9px] font-black rounded-lg text-gray-600 active:scale-95 transition-all"
                    >
                      A4
                    </button>
                  </div>
                </div>
              )}

              {queue.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center p-8 gap-3 text-gray-400">
                  <Printer className="w-12 h-12 stroke-[1.25] text-gray-300" />
                  <div>
                    <h4 className="font-bold text-gray-700 text-sm">La cola está vacía</h4>
                    <p className="text-[11px] text-gray-400 mt-1 max-w-[200px] leading-relaxed">
                      Escaneá carteles en modo continuo o ingresá a las fichas y seleccionalos para armar tu lote.
                    </p>
                  </div>
                </div>
              ) : (
                queue.map((item) => (
                  <div 
                    key={item.sku}
                    className="bg-white rounded-2xl border border-gray-150 p-3.5 shadow-sm flex items-start gap-3 hover:border-gray-300 transition-colors"
                  >
                    {/* Foto */}
                    <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                      <img 
                        src={item.foto_url || 'https://placehold.co/100?text=Sin+Foto'} 
                        alt={item.sku} 
                        className="max-w-full max-h-full object-contain" 
                      />
                    </div>

                    {/* Contenido / Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between h-full min-h-[56px]">
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-mono font-bold text-gray-700 text-xs truncate">SAP {item.sku}</span>
                          <span className="text-[8px] bg-red-50 text-easy-red px-1.5 py-0.5 rounded font-black uppercase shrink-0">
                            {item.marca || 'GENERICA'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-semibold truncate leading-snug mt-0.5">
                          {item.descripcion}
                        </p>
                      </div>

                      {/* Controles de plantilla y copias */}
                      <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-gray-50 gap-2">
                        {/* Selector de plantilla */}
                        <select
                          value={item.template || 'fleje3'}
                          onChange={(e) => handleUpdateTemplate(item.sku, e.target.value)}
                          className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[10px] font-bold text-gray-600 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-easy-red shrink-0"
                        >
                          <option value="fleje3">Fleje 3 (90x74)</option>
                          <option value="fleje2">Fleje 2 (80x40)</option>
                          <option value="a4">Ficha A4</option>
                        </select>

                        {/* Copias e Impresión individual */}
                        <div className="flex items-center gap-3">
                          {/* Modificador cantidad */}
                          <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                            <button
                              onClick={() => handleUpdateQty(item.sku, -1)}
                              className="px-2 py-1 text-gray-500 hover:bg-gray-200 active:scale-95 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 text-[10px] font-bold font-mono text-gray-700">
                              {item.cantidad || 1}
                            </span>
                            <button
                              onClick={() => handleUpdateQty(item.sku, 1)}
                              className="px-2 py-1 text-gray-500 hover:bg-gray-200 active:scale-95 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Previsualizar */}
                          <button
                            onClick={() => setPreviewItem(item)}
                            className="p-1.5 text-gray-400 hover:text-easy-red hover:bg-red-50 rounded-lg transition-colors"
                            title="Previsualizar cartel"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Eliminar de cola */}
                          <button
                            onClick={() => handleRemove(item.sku)}
                            className="p-1.5 text-gray-400 hover:text-easy-red hover:bg-red-50 rounded-lg transition-colors"
                            title="Quitar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                ))
              )}

            </div>

            {/* Footer de Acciones del Drawer */}
            {queue.length > 0 && (
              <div className="p-4 border-t border-gray-150 bg-gray-50 space-y-2">
                <div className="flex gap-2">
                  <button
                    disabled={loading}
                    onClick={handleClearAll}
                    className="flex-1 border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 font-bold py-3 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95 flex justify-center items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" /> Vaciar Cola
                  </button>

                  <button
                    disabled={loading}
                    onClick={handlePrintBatch}
                    className="flex-[2] bg-easy-yellow hover:bg-yellow-400 text-easy-dark font-black py-3 rounded-xl text-xs uppercase tracking-wide transition-all active:scale-95 flex justify-center items-center gap-1.5 shadow-md shadow-yellow-400/10 disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-easy-dark" />
                    ) : (
                      <Printer className="w-4 h-4" />
                    )}
                    {loading ? 'Generando Lote...' : `Imprimir Lote (${totalLabelsCount})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Renderizado de Previsualización en Caliente P1.24 */}
      {previewItem && (
        <FichaPreviewModal
          sku={previewItem.sku}
          currentSpecs={{
            marca: previewItem.marca,
            tipo_herramienta: previewItem.tipo_herramienta,
            especificaciones: previewItem.especificaciones_json?.especificaciones || []
          }}
          currentFotoUrl={previewItem.foto_url}
          templateName={previewItem.template || 'fleje3'}
          onClose={() => setPreviewItem(null)}
        />
      )}

      {/* Toast no bloqueante al vaciar la cola P1.21 */}
      {showClearToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-easy-dark/95 backdrop-blur-sm text-white px-5 py-3 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2.5 z-50 animate-fade-in border border-white/10 select-none">
          <span className="text-green-500 text-sm">✓</span>
          <span>Cola de impresión vaciada</span>
        </div>
      )}

      {/* Cartel Flotante de Confirmación de Descarga de Lote */}
      {downloadSuccessToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 max-w-md w-[92%] bg-emerald-600/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl z-[60] flex items-center justify-between border border-emerald-400/40 select-none animate-bounce">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="text-left min-w-0">
              <span className="font-bold text-xs block leading-none">¡Lote PDF generado con éxito!</span>
              <span className="text-[10px] text-emerald-100 font-semibold truncate block mt-1 font-mono">
                {downloadSuccessToast}
              </span>
            </div>
          </div>
          <button 
            onClick={() => setDownloadSuccessToast(null)} 
            className="p-1.5 hover:bg-white/20 active:scale-95 rounded-lg text-emerald-100 hover:text-white transition-colors shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
