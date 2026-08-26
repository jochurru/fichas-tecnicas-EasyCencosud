import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Shield, Globe } from 'lucide-react';

/**
 * @fileoverview Componente para la edición y ordenamiento dinámico de la lista de especificaciones técnicas.
 * Limitado a 7 atributos máximo (capacidad física de la etiqueta) con trazabilidad automática a MANUAL al editar.
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
    // Al modificar manualmente cualquier campo (clave o valor), la especificación cambia automáticamente su origen a MANUAL
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
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
      {/* Header del Editor de Especificaciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-extrabold text-gray-800 text-sm sm:text-base flex items-center gap-2">
            <span>Especificaciones Técnicas</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isMaxReached ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {especificaciones.length}/{MAX_SPECS} Atributos
            </span>
          </h4>
          <p className="text-xs text-gray-400 font-medium">Atributos visibles en la ficha e impresiones físicas (Máximo 7)</p>
        </div>

        {/* Botones de Acción y Accesos Directos */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {!hasGarantia && !isMaxReached && (
            <button
              type="button"
              disabled={isReadOnly || isOffline}
              onClick={() => addSpec('Garantía', '2 Años')}
              className="flex items-center gap-1 text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold px-2.5 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50"
              title="Añadir atributo de Garantía editable"
            >
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              + Garantía
            </button>
          )}

          {!hasOrigen && !isMaxReached && (
            <button
              type="button"
              disabled={isReadOnly || isOffline}
              onClick={() => addSpec('Origen', 'China')}
              className="flex items-center gap-1 text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold px-2.5 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50"
              title="Añadir atributo de Origen editable"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              + Origen
            </button>
          )}

          <button
            type="button"
            disabled={isReadOnly || isOffline || isMaxReached}
            onClick={() => addSpec()}
            className="flex items-center gap-1 text-xs bg-easy-red hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ml-auto"
          >
            <Plus className="w-4 h-4" />
            {isMaxReached ? 'Límite Alcanzado (7)' : 'Agregar Atributo'}
          </button>
        </div>
      </div>

      {isMaxReached && (
        <div className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
          ⚠️ Has alcanzado el límite máximo de 7 atributos. Este límite garantiza que toda la información se imprima con excelente legibilidad en los flejes físicos (90x74mm y 80x40mm).
        </div>
      )}

      {/* Lista de Especificaciones Responsiva Mobile-First */}
      <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
        {especificaciones.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs font-semibold">
            No hay especificaciones cargadas. Hacé clic en "Agregar Atributo" para comenzar.
          </div>
        ) : (
          especificaciones.map((spec, idx) => (
            <div 
              key={idx} 
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-gray-50/70 p-2.5 rounded-xl border border-gray-150 group transition-all hover:bg-gray-100/70"
            >
              {/* Entradas de Texto (Atributo + Valor) con ancho completo en mobile */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[11px] font-bold text-gray-400 w-4 text-center shrink-0">{idx + 1}</span>
                
                <input
                  type="text"
                  disabled={isReadOnly || isOffline}
                  placeholder="Atributo (ej: Potencia)"
                  value={spec.clave}
                  onChange={(e) => updateSpec(idx, 'clave', e.target.value)}
                  className="flex-1 min-w-0 text-xs font-semibold px-2.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-easy-red bg-white disabled:opacity-60 disabled:bg-gray-50"
                />

                <input
                  type="text"
                  disabled={isReadOnly || isOffline}
                  placeholder="Valor (ej: 800W)"
                  value={spec.valor}
                  onChange={(e) => updateSpec(idx, 'valor', e.target.value)}
                  className="flex-1 min-w-0 text-xs font-medium px-2.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-easy-red bg-white disabled:opacity-60 disabled:bg-gray-50"
                />
              </div>
              
              {/* Barra de Controles y Badge de Trazabilidad */}
              <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-gray-150">
                <span 
                  className={`text-[8px] font-black uppercase px-2 py-0.5 rounded select-none shrink-0 ${
                    spec.origen === 'SAP' 
                      ? 'bg-gray-200 text-gray-600' 
                      : spec.origen === 'IA' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                  }`}
                  title={`Validación: ${spec.fecha_validacion || 'Desconocida'}`}
                >
                  {spec.origen || 'SAP'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isReadOnly || isOffline || idx === 0}
                    onClick={() => moveSpec(idx, -1)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded hover:bg-gray-200 transition-colors"
                    title="Mover arriba"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isReadOnly || isOffline || idx === especificaciones.length - 1}
                    onClick={() => moveSpec(idx, 1)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded hover:bg-gray-200 transition-colors"
                    title="Mover abajo"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isReadOnly || isOffline}
                    onClick={() => removeSpec(idx)}
                    className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Eliminar atributo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
