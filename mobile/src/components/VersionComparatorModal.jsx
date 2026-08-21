import React, { useState, useEffect } from 'react';
import { X, GitCommit, ArrowLeftRight, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function VersionComparatorModal({ sku, currentSpecs, currentFotoUrl, token, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [diff, setDiff] = useState(null);

  useEffect(() => {
    loadHistory();
  }, [sku]);

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/fichas/${sku}/historial`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error('Error al descargar el historial de versiones.');
      }
      const data = await res.json();
      setHistory(data);
      if (data.length > 0) {
        // Seleccionar la última versión guardada automáticamente para comparar
        handleSelectVersion(data[0], data[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVersion = (histRecord) => {
    setSelectedVersion(histRecord);
    
    // Calcular diferencias contra currentSpecs
    const currentList = currentSpecs?.especificaciones || [];
    const histList = histRecord?.especificaciones_json?.especificaciones || [];

    const currentMap = {};
    currentList.forEach(s => { if (s.clave) currentMap[s.clave.trim()] = s.valor || ''; });

    const histMap = {};
    histList.forEach(s => { if (s.clave) histMap[s.clave.trim()] = s.valor || ''; });

    const allKeys = Array.from(new Set([
      ...Object.keys(currentMap),
      ...Object.keys(histMap)
    ]));

    const diffResults = [];

    // Comparar la marca
    const currentMarca = currentSpecs?.marca || '';
    const histMarca = histRecord?.especificaciones_json?.marca || '';
    if (currentMarca !== histMarca) {
      diffResults.push({
        campo: 'Marca',
        tipo: 'MODIFICADO',
        historico: histMarca || '(Vacío)',
        actual: currentMarca || '(Vacío)'
      });
    }

    // Comparar especificaciones clave
    allKeys.forEach(key => {
      const curVal = currentMap[key];
      const histVal = histMap[key];

      if (curVal !== undefined && histVal === undefined) {
        // Agregado en el actual
        diffResults.push({
          campo: key,
          tipo: 'AGREGADO',
          historico: null,
          actual: curVal
        });
      } else if (curVal === undefined && histVal !== undefined) {
        // Eliminado en el actual
        diffResults.push({
          campo: key,
          tipo: 'ELIMINADO',
          historico: histVal,
          actual: null
        });
      } else if (curVal !== histVal) {
        // Modificado
        diffResults.push({
          campo: key,
          tipo: 'MODIFICADO',
          historico: histVal,
          actual: curVal
        });
      }
    });

    setDiff({
      version: histRecord.version,
      usuario: histRecord.modificado_por,
      fecha: new Date(histRecord.created_at).toLocaleString(),
      origen: histRecord.origen_cambio,
      fotoCambio: histRecord.foto_url !== currentFotoUrl,
      fotoHistorica: histRecord.foto_url,
      cambios: diffResults
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border border-gray-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gray-50/70 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black text-gray-700">Historial de Ficha SKU {sku}</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Comparador de Cambios inmutable</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-all active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 text-easy-red animate-spin" />
              <span className="text-xs text-gray-400 font-bold">Cargando versiones históricas...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="py-12 text-center text-xs text-gray-400 font-medium">
              No hay versiones históricas guardadas para este producto todavía.
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="space-y-4">
              
              {/* Timeline Selector */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Línea de Tiempo de Versiones</label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {history.map((record) => (
                    <button
                      key={record.id}
                      onClick={() => handleSelectVersion(record)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                        selectedVersion?.id === record.id
                          ? 'bg-easy-red border-easy-red text-white shadow-sm'
                          : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-500'
                      }`}
                    >
                      <GitCommit className="w-3.5 h-3.5" />
                      <span>v{record.version}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Comparador Diff */}
              {diff && (
                <div className="space-y-4">
                  
                  {/* Meta de la versión comparada */}
                  <div className="bg-gray-50 rounded-2xl p-3 border border-gray-150 text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-bold">Modificado por:</span>
                      <span className="text-gray-600 font-bold font-mono">{diff.usuario}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-bold">Fecha:</span>
                      <span className="text-gray-500 font-semibold">{diff.fecha}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-bold">Origen:</span>
                      <span className="bg-red-50 text-easy-red font-black px-1.5 py-0.5 rounded text-[9px] uppercase">{diff.origen}</span>
                    </div>
                  </div>

                  {/* Tabla de Cambios */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      <ArrowLeftRight className="w-4 h-4 text-easy-red" />
                      <span>Diferencias contra versión cargada</span>
                    </div>

                    <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50">
                      {diff.cambios.length === 0 && !diff.fotoCambio ? (
                        <div className="p-4 text-center text-xs text-green-600 bg-green-50/50 flex justify-center items-center gap-1.5 font-bold">
                          <Check className="w-4 h-4" /> La versión seleccionada es idéntica a la cargada.
                        </div>
                      ) : (
                        diff.cambios.map((cambio, idx) => (
                          <div 
                            key={idx} 
                            className={`p-3 text-xs grid grid-cols-3 gap-2 items-center ${
                              cambio.tipo === 'AGREGADO' 
                                ? 'bg-green-50/45' 
                                : cambio.tipo === 'ELIMINADO' 
                                  ? 'bg-rose-50/45' 
                                  : 'bg-yellow-50/45'
                            }`}
                          >
                            <span className="font-bold text-gray-600 truncate">{cambio.campo}</span>
                            
                            <span className="text-gray-400 line-through truncate font-mono">
                              {cambio.tipo === 'AGREGADO' ? '-' : cambio.historico}
                            </span>
                            
                            <span className={`font-bold font-mono truncate ${
                              cambio.tipo === 'AGREGADO' 
                                ? 'text-green-600' 
                                : cambio.tipo === 'ELIMINADO' 
                                  ? 'text-rose-600' 
                                  : 'text-yellow-700'
                            }`}>
                              {cambio.tipo === 'ELIMINADO' ? '-' : cambio.actual}
                            </span>
                          </div>
                        ))
                      )}

                      {/* Diferencia en foto */}
                      {diff.fotoCambio && (
                        <div className="p-3 text-xs bg-yellow-50/45 flex items-center justify-between gap-2">
                          <span className="font-bold text-gray-600">Foto del Producto</span>
                          <span className="text-yellow-700 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" /> La imagen difiere
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="bg-easy-dark text-white font-bold px-5 py-2.5 rounded-xl text-xs active:scale-95 transition-all shadow-sm"
          >
            Aceptar
          </button>
        </div>

      </div>
    </div>
  );
}