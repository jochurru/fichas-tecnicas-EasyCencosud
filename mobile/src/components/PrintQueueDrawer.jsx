import React, { useState, useEffect } from 'react';
import { Printer, X, Trash2, Plus, Minus, Eye, RefreshCw, FileText } from 'lucide-react';
import { getPrintQueue, savePrintQueueItem, removePrintQueueItem, clearPrintQueue } from '../lib/indexedDb';
import { API_BASE_URL } from '../config';
import FichaPreviewModal from './FichaPreviewModal';

export default function PrintQueueDrawer({ token, onPrintSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);

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

  // Vaciar la cola
  const handleClearAll = async () => {
    if (window.confirm('¿Seguro que querés vaciar la cola de impresión?')) {
      await clearPrintQueue();
      loadQueue();
    }
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
      link.setAttribute('download', `lote_impresion_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(fileUrl);

      // Limpiar cola local
      await clearPrintQueue();
      loadQueue();
      setIsOpen(false);
      
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

  return (
    <>
      {/* Botón Acción Flotante (FAB) P1.21 */}
      <button
        onClick={toggleDrawer}
        className="fixed bottom-6 right-6 z-40 bg-easy-red hover:bg-red-700 text-white font-bold px-4 py-3.5 rounded-full shadow-lg shadow-easy-red/30 flex items-center gap-2 active:scale-95 transition-all select-none"
      >
        <Printer className="w-5 h-5 text-white" />
        <span className="text-xs uppercase tracking-wider">Cola de Impresión</span>
        {queue.length > 0 && (
          <span className="bg-white text-easy-red text-[10px] font-black rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center shadow-inner border border-red-100">
            {totalLabelsCount}
          </span>
        )}
      </button>

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
    </>
  );
}
