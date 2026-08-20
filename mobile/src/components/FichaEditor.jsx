import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, FileText, CheckCircle, AlertCircle, Image, Layers, Eye, Printer } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function FichaEditor({ data, onSaveSuccess }) {
  const { producto, ficha_tecnica } = data;
  const specData = ficha_tecnica?.especificaciones_json || {};

  // Estados locales del formulario
  const [marca, setMarca] = useState('');
  const [tipoHerramienta, setTipoHerramienta] = useState('');
  const [especificaciones, setEspecificaciones] = useState([]);
  const [sugerenciaImagen, setSugerenciaImagen] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [templatePreferido, setTemplatePreferido] = useState(1);
  const [aprobadoPor, setAprobadoPor] = useState('OPERADOR_LOCAL');
  const [ean, setEan] = useState('');
  
  // Feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sincronizar estados cuando los datos de entrada cambien
  useEffect(() => {
    setMarca(specData.marca || '');
    setTipoHerramienta(specData.tipo_herramienta || '');
    setEspecificaciones(
      Array.isArray(specData.especificaciones) 
        ? [...specData.especificaciones] 
        : []
    );
    setSugerenciaImagen(specData.sugerencia_busqueda_imagen || '');
    setFotoUrl(ficha_tecnica?.foto_url || '');
    setTemplatePreferido(ficha_tecnica?.template_preferido || 1);
    setEan(producto.eans && producto.eans.length > 0 ? producto.eans[0] : '');
  }, [data]);

  // Manejo de cambios en las especificaciones dinámicas
  const handleSpecChange = (index, field, value) => {
    const updated = [...especificaciones];
    updated[index][field] = value;
    setEspecificaciones(updated);
  };

  const handlePrintAction = async (action) => {
    try {
      // Mapear id del template preferido al string esperado por el backend
      let templateName = 'fleje3';
      if (templatePreferido === 1) templateName = 'a4';
      if (templatePreferido === 3) templateName = 'fleje2';

      // 1. Llamar al endpoint POST
      const response = await fetch(`${API_BASE_URL}/fichas/imprimir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sku: producto.sku,
          template: templateName
        })
      });

      if (!response.ok) {
        throw new Error('Error al generar el PDF de impresión.');
      }

      // 2. Leer la respuesta como Blob binario
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      if (action === 'preview') {
        // Abrir previsualización en pestaña nueva
        window.open(blobUrl, '_blank');
      } else {
        // Disparar diálogo de impresión a través de iframe oculto
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = blobUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          // Limpiar iframe y liberar memoria
          setTimeout(() => {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(blobUrl);
          }, 1500);
        };
      }
    } catch (err) {
      console.error('Error de impresión:', err);
      alert('Hubo un error al generar la cartela de impresión: ' + err.message);
    }
  };

  const addSpecification = () => {
    setEspecificaciones([...especificaciones, { clave: '', valor: '' }]);
  };

  const removeSpecification = (index) => {
    setEspecificaciones(especificaciones.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Limpiar claves vacías antes de enviar
    const cleanSpecs = especificaciones.filter(
      (spec) => spec.clave.trim() !== '' || spec.valor.trim() !== ''
    );

    const payload = {
      sku: producto.sku,
      especificaciones_json: {
        marca,
        tipo_herramienta: tipoHerramienta,
        especificaciones: cleanSpecs,
        sugerencia_busqueda_imagen: sugerenciaImagen
      },
      foto_url: fotoUrl.trim() || null,
      template_preferido: templatePreferido,
      aprobado_por: aprobadoPor,
      ean: ean.trim() || null
    };

    try {
      const response = await fetch(`${API_BASE_URL}/fichas/aprobar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al guardar la ficha');
      }

      setSuccessMsg('Ficha técnica aprobada y guardada con éxito.');
      setTimeout(() => {
        onSaveSuccess(result.ficha_tecnica, ean.trim() || null);
      }, 1500);

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Fallo de conexión al guardar la ficha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
      {/* Cabecera del Editor */}
      <div className="bg-gray-50 px-5 py-4 border-b border-gray-100 flex justify-between items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-easy-red bg-red-50 px-2 py-0.5 rounded">
            Ficha Técnica
          </span>
          <h2 className="text-xl font-bold text-easy-dark mt-1">SKU {producto.sku}</h2>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          ficha_tecnica?.estado === 'aprobado' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {ficha_tecnica?.estado === 'aprobado' ? '✓ Aprobada' : '✍ Borrador IA'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-6">
        
        {/* Sección: Datos de SAP (Solo lectura) */}
        <div>
          <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Detalles Maestros (SAP)</h3>
          <div className="bg-gray-50 rounded-xl p-3.5 text-sm space-y-1.5">
            <p><strong className="text-gray-500 font-medium">Descripción:</strong> {producto.descripcion}</p>
            <p><strong className="text-gray-500 font-medium">Proveedor:</strong> {producto.proveedor}</p>
            <p><strong className="text-gray-500 font-medium">Grupo Artículos:</strong> {producto.grupo_articulos}</p>
          </div>
        </div>

        {/* Sección: Atributos Base */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase text-gray-400">Atributos Básicos de Ficha</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Marca</label>
              <input
                type="text"
                required
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Ej. Stanley, Bosch"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Tipo de Herramienta</label>
              <input
                type="text"
                required
                value={tipoHerramienta}
                onChange={(e) => setTipoHerramienta(e.target.value)}
                placeholder="Ej. Taladro, Caja Grapas"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Código de Barras / EAN</label>
            <input
              type="text"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              placeholder="Ej. 7791234567890 (opcional)"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1">
              <Image className="w-3.5 h-3.5 text-gray-500" /> URL de Imagen / Foto
            </label>
            <input
              type="url"
              value={fotoUrl}
              onChange={(e) => setFotoUrl(e.target.value)}
              placeholder="https://ejemplo.com/foto.jpg"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all"
            />
            {fotoUrl && (
              <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden w-28 h-28 bg-gray-50 flex items-center justify-center">
                <img 
                  src={fotoUrl} 
                  alt="Vista previa" 
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://placehold.co/100?text=Error+Img';
                  }}
                />
              </div>
            )}
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

        {/* Sección: Especificaciones Técnicas Dinámicas */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold uppercase text-gray-400">Especificaciones Técnicas</h3>
            <button
              type="button"
              onClick={addSpecification}
              className="flex items-center gap-1 text-xs font-bold text-easy-red bg-red-50 hover:bg-red-100 active:scale-95 px-2.5 py-1.5 rounded-lg transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar campo
            </button>
          </div>

          <div className="space-y-2">
            {especificaciones.map((spec, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={spec.clave}
                  onChange={(e) => handleSpecChange(index, 'clave', e.target.value)}
                  placeholder="Atributo (ej. Potencia)"
                  className="flex-1 min-w-0 bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-easy-red focus:border-easy-red"
                />
                <input
                  type="text"
                  value={spec.valor}
                  onChange={(e) => handleSpecChange(index, 'valor', e.target.value)}
                  placeholder="Valor (ej. 750W)"
                  className="flex-1 min-w-0 bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-easy-red focus:border-easy-red"
                />
                <button
                  type="button"
                  onClick={() => removeSpecification(index)}
                  className="p-2 text-gray-400 hover:text-easy-red hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {especificaciones.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                No hay especificaciones agregadas. Hacé clic en "Agregar campo" para sumar atributos.
              </p>
            )}
          </div>
        </div>

        {/* Sección: Template de Impresión Lexmark */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase text-gray-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Plantilla de Impresión (Lexmark)
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 1, name: 'Ficha A4', desc: 'Completa A4' },
              { id: 2, name: 'Fleje 3', desc: 'Estándar 90mm' },
              { id: 3, name: 'Fleje 2', desc: 'Compacto 80x40' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplatePreferido(t.id)}
                className={`p-2.5 border rounded-xl text-left flex flex-col justify-between transition-all active:scale-95 ${
                  templatePreferido === t.id
                    ? 'border-easy-red bg-red-50 text-easy-dark ring-2 ring-easy-red/20'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
                }`}
              >
                <span className="text-sm font-bold block">{t.name}</span>
                <span className="text-[10px] text-gray-400 block mt-0.5">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sección: Aprobador (Local) */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">Aprobado Por (Nombre Operador)</label>
          <input
            type="text"
            required
            value={aprobadoPor}
            onChange={(e) => setAprobadoPor(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all"
          />
        </div>

        {/* Alerts de Feedback */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 flex gap-2 text-sm items-start">
            <AlertCircle className="w-5 h-5 text-easy-red shrink-0 mt-0.5" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 flex gap-2 text-sm items-start">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <p className="font-medium">{successMsg}</p>
          </div>
        )}

        {/* Botón de Guardado */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-easy-red hover:bg-red-700 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl shadow-md shadow-easy-red/25 hover:shadow-lg transition-all flex justify-center items-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Guardando...' : 'Aprobar y Guardar Ficha'}
        </button>

        {/* Botones de Impresión y Vista Previa */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            type="button"
            onClick={() => handlePrintAction('preview')}
            className="bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-gray-700 font-bold py-3 rounded-xl border border-gray-200 transition-all flex justify-center items-center gap-1.5 text-xs"
          >
            <Eye className="w-4 h-4" />
            Vista Previa
          </button>
          <button
            type="button"
            onClick={() => handlePrintAction('print')}
            className="bg-easy-yellow hover:bg-yellow-400 active:scale-[0.98] text-easy-dark font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-1.5 text-xs shadow-sm shadow-yellow-400/10"
          >
            <Printer className="w-4 h-4" />
            Imprimir Cartela
          </button>
        </div>

      </form>
    </div>
  );
}
