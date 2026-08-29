import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Shield, Globe, Sparkles } from 'lucide-react';

/**
 * @fileoverview Componente para la edición y ordenamiento dinámico de la lista de especificaciones técnicas.
 * Diseño ultra-legible y responsivo sin truncamiento de texto.
 * Limitado a 7 atributos máximo (capacidad física de la etiqueta).
 */

export default function SpecsEditorList({ especificaciones, setEspecificaciones, isReadOnly, isOffline }) {
  const MAX_SPECS = 7;
  const isMaxReached = especificaciones.length >= MAX_SPECS;

  const addSpec = (defaultClave = '', defaultValor = '') => {
    if (isMaxReached) return;
    setEspecificaciones([
      ...especificaciones, 
      { 
        clave: defaultClave, 
        valor: defaultValor, 
        origen: 'MANUAL', 
        fecha_validacion: new Date().toISOString().split('T')[0] 
      }
    ]);
  };

  const removeSpec = (index) => {
    setEspecificaciones(especificaciones.filter((_, i) => i !== index));
  };

  const updateSpec = (index, field, value) => {
    const updated = [...especificaciones];
    const current = updated[index] || {};
    updated[index] = { 
      ...current, 
      [field]: value,
      origen: 'MANUAL',
      fecha_validacion: new Date().toISOString().split('T')[0]
    };
    setEspecificaciones(updated);
  };

  const moveSpec = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= especificaciones.length) return;
    const updated = [...especificaciones];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);
    setEspecificaciones(updated);
  };

  const hasGarantia = especificaciones.some(s => (s.clave || '').toLowerCase().includes('garant'));
  const hasOrigen = especificaciones.some(s => (s.clave || '').toLowerCase().includes('origen') || (s.clave || '').toLowerCase().includes('país'));

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 font-sans">
      {/* Header del Editor */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <span>Especificaciones Técnicas</span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                isMaxReached ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700'
              }`}>
                {especificaciones.length}/{MAX_SPECS} Atributos
              </span>
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Información visible en la ficha e impresiones de góndola (Máximo 7)
            </p>
          </div>

          <button
            type="button"
            disabled={isReadOnly || isOffline || isMaxReached}
            onClick={() => addSpec()}
            className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-2 rounded-xl shadow-md shadow-red-600/20 transition active:scale-95 disabled:opacity-50 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{isMaxReached ? 'Límite (7)' : 'Agregar'}</span>
          </button>
        </div>

        {/* Atajos Rápidos */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {!hasGarantia && !isMaxReached && (
            <button
              type="button"
              disabled={isReadOnly || isOffline}
              onClick={() => addSpec('Garantía', '2 Años')}
              className="flex items-center gap-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold px-2.5 py-1 rounded-lg transition active:scale-95 disabled:opacity-50"
            >
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <span>+ Garantía</span>
            </button>
          )}

          {!hasOrigen && !isMaxReached && (
            <button
              type="button"
              disabled={isReadOnly || isOffline}
              onClick={() => addSpec('Origen', 'China')}
              className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold px-2.5 py-1 rounded-lg transition active:scale-95 disabled:opacity-50"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>+ Origen</span>
            </button>
          )}
        </div>
      </div>

      {isMaxReached && (
        <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-xl">
          ⚠️ Alcanzaste el límite de 7 atributos. Este límite garantiza que la letra no se achique en la impresión física.
        </div>
      )}

      {/* Lista de Atributos con Filas Claras y Anchas */}
      <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
        {especificaciones.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs font-medium">
            No hay especificaciones cargadas. Tocá en "+ Agregar" para crear la primera.
          </div>
        ) : (
          especificaciones.map((spec, idx) => (
            <div 
              key={idx} 
              className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 space-y-2 hover:border-slate-300 transition"
            >
              {/* Barra Superior de la Fila: Número, Badge de Origen y Botones de Orden */}
              <div className="flex items-center justify-between text-xs border-b border-slate-200/60 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    spec.origen === 'SAP' 
                      ? 'bg-slate-200 text-slate-600' 
                      : spec.origen === 'IA' 
                        ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}>
                    {spec.origen || 'SAP'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isReadOnly || isOffline || idx === 0}
                    onClick={() => moveSpec(idx, -1)}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200 transition"
                    title="Mover arriba"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isReadOnly || isOffline || idx === especificaciones.length - 1}
                    onClick={() => moveSpec(idx, 1)}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200 transition"
                    title="Mover abajo"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isReadOnly || isOffline}
                    onClick={() => removeSpec(idx)}
                    className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-100/60 disabled:opacity-30 transition ml-1"
                    title="Eliminar atributo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Fila de Inputs Anchos: 40% Atributo / 60% Valor */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <input
                    type="text"
                    disabled={isReadOnly || isOffline}
                    placeholder="Ej: Material"
                    value={spec.clave}
                    onChange={(e) => updateSpec(idx, 'clave', e.target.value)}
                    className="w-full text-xs font-bold text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 bg-white shadow-sm"
                  />
                </div>

                <div className="col-span-7">
                  <input
                    type="text"
                    disabled={isReadOnly || isOffline}
                    placeholder="Ej: Acero SK5 templado"
                    value={spec.valor}
                    onChange={(e) => updateSpec(idx, 'valor', e.target.value)}
                    className="w-full text-xs font-semibold text-slate-700 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
