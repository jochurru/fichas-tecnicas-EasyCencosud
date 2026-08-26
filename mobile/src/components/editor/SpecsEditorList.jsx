import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

/**
 * @fileoverview Componente para la edición y ordenamiento dinámico de la lista de especificaciones técnicas.
 */

export default function SpecsEditorList({ especificaciones, setEspecificaciones, isReadOnly, isOffline }) {
  const addSpec = () => {
    setEspecificaciones([...especificaciones, { clave: '', valor: '', origen: 'MANUAL', fecha_validacion: new Date().toISOString().split('T')[0] }]);
  };

  const removeSpec = (index) => {
    setEspecificaciones(especificaciones.filter((_, i) => i !== index));
  };

  const updateSpec = (index, field, value) => {
    const updated = [...especificaciones];
    updated[index] = { ...updated[index], [field]: value };
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

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-bold text-gray-800 text-sm">Especificaciones Técnicas</h4>
          <p className="text-xs text-gray-400 font-medium">Atributos visibles en la ficha e impresiones físicas</p>
        </div>
        <button
          type="button"
          disabled={isReadOnly || isOffline}
          onClick={addSpec}
          className="flex items-center gap-1 text-xs bg-easy-red hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Plus className="w-4 h-4" />
          Agregar Atributo
        </button>
      </div>

      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
        {especificaciones.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs font-semibold">
            No hay especificaciones cargadas. Hacé clic en "Agregar Atributo" para comenzar.
          </div>
        ) : (
          especificaciones.map((spec, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-gray-50/60 p-2 rounded-xl border border-gray-100 group">
              <span className="text-[10px] font-bold text-gray-400 w-5 text-center">{idx + 1}</span>
              <input
                type="text"
                disabled={isReadOnly || isOffline}
                placeholder="Atributo (ej: Potencia)"
                value={spec.clave}
                onChange={(e) => updateSpec(idx, 'clave', e.target.value)}
                className="w-1/2 text-xs font-semibold px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-easy-red bg-white disabled:opacity-60 disabled:bg-gray-50"
              />
              <input
                type="text"
                disabled={isReadOnly || isOffline}
                placeholder="Valor (ej: 800W)"
                value={spec.valor}
                onChange={(e) => updateSpec(idx, 'valor', e.target.value)}
                className="w-1/2 text-xs font-medium px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-easy-red bg-white disabled:opacity-60 disabled:bg-gray-50"
              />
              
              {/* Badge de Trazabilidad de Atributo P1.3 */}
              <span 
                className={`text-[8px] font-black uppercase px-1.5 py-1 rounded shrink-0 select-none ${
                  spec.origen === 'SAP' 
                    ? 'bg-gray-150 text-gray-500' 
                    : spec.origen === 'IA' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-blue-100 text-blue-700'
                }`}
                title={`Validación: ${spec.fecha_validacion || 'Desconocida'}`}
              >
                {spec.origen || 'SAP'}
              </span>

              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                <button
                  type="button"
                  disabled={isReadOnly || isOffline || idx === 0}
                  onClick={() => moveSpec(idx, -1)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded hover:bg-gray-200"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={isReadOnly || isOffline || idx === especificaciones.length - 1}
                  onClick={() => moveSpec(idx, 1)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded hover:bg-gray-200"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={isReadOnly || isOffline}
                  onClick={() => removeSpec(idx)}
                  className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
