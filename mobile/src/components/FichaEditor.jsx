import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Save, FileText, CheckCircle, AlertCircle, 
  Image, Layers, Eye, Printer, RefreshCw, GitCommit, ShieldAlert,
  HelpCircle, QrCode, X
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import CompletenessBar from './CompletenessBar';
import VersionComparatorModal from './VersionComparatorModal';
import Scanner from './Scanner';
import { calculateCompleteness, detectInconsistencies, getEstadoMetadata } from '../lib/dataQuality';

export default function FichaEditor({ data, token, userEmail, onSaveSuccess, onTokenExpired }) {
  const { producto, ficha_tecnica } = data;
  const specData = ficha_tecnica?.especificaciones_json || {};
  const isOffline = data?.origen === 'local_offline';
  
  // Roles de permisos: Solo administradores y coordinadores de cartelería pueden editar/aprobar fichas
  const canEdit = userEmail && (userEmail.includes('admin') || userEmail.includes('coord'));
  const isReadOnly = !canEdit;

  // Estados locales del formulario
  const [marca, setMarca] = useState('');
  const [tipoHerramienta, setTipoHerramienta] = useState('');
  const [especificaciones, setEspecificaciones] = useState([]);
  const [sugerenciaImagen, setSugerenciaImagen] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [templatePreferido, setTemplatePreferido] = useState(1);
  const [aprobadoPor, setAprobadoPor] = useState('OPERADOR_LOCAL');
  const [eans, setEans] = useState([]);
  const [newEanText, setNewEanText] = useState('');
  const [scanActiveForEan, setScanActiveForEan] = useState(false);
  const [estado, setEstado] = useState('BORRADOR');
  
  // Analítica de Calidad en tiempo real
  const [completeness, setCompleteness] = useState(0);
  const [inconsistencies, setInconsistencies] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Feedback
  const [loading, setLoading] = useState(false);
  const [pdfLoadingState, setPdfLoadingState] = useState('idle'); // 'idle' | 'preview' | 'print'
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sincronizar estados cuando los datos de entrada cambien
  useEffect(() => {
    const defaultOrigen = ficha_tecnica?.estado === 'GENERADA_POR_IA' || ficha_tecnica?.estado === 'borrador_ia' ? 'IA' : 'SAP';
    
    setMarca(specData.marca || '');
    setTipoHerramienta(specData.tipo_herramienta || '');
    setEspecificaciones(
      Array.isArray(specData.especificaciones) 
        ? specData.especificaciones.map(s => ({
            clave: s.clave || '',
            valor: s.valor || '',
            origen: s.origen || defaultOrigen,
            fecha_validacion: s.fecha_validacion || new Date().toISOString().split('T')[0]
          }))
        : []
    );
    setSugerenciaImagen(specData.sugerencia_busqueda_imagen || '');
    setFotoUrl(ficha_tecnica?.foto_url || '');
    setTemplatePreferido(ficha_tecnica?.template_preferido || 1);
    setEans(producto.eans || []);
    setEstado(ficha_tecnica?.estado || (ficha_tecnica ? 'PENDIENTE_VALIDACION' : 'BORRADOR'));
    
    // El aprobador por defecto es siempre el usuario activo de esta sesión, para registrar su firma en caso de guardar
    setAprobadoPor(userEmail || 'OPERADOR_LOCAL');
  }, [data, userEmail]);

  // Calcular completitud e inconsistencias en tiempo real
  useEffect(() => {
    const tempFicha = {
      foto_url: fotoUrl,
      ean: eans && eans.length > 0 ? eans[0] : '',
      especificaciones_json: {
        marca,
        tipo_herramienta: tipoHerramienta,
        especificaciones
      }
    };
    const score = calculateCompleteness(producto, tempFicha);
    const alerts = detectInconsistencies(producto, tempFicha);
    
    setCompleteness(score);
    setInconsistencies(alerts);
  }, [marca, tipoHerramienta, especificaciones, fotoUrl, ean, producto]);

  // Manejo de cambios en las especificaciones dinámicas
  const handleSpecChange = (index, field, value) => {
    const updated = [...especificaciones];
    updated[index][field] = value;
    // Trazabilidad por Atributo (P1.3): Atribuir edición manual al Operador activo
    updated[index].origen = 'Usuario';
    updated[index].fecha_validacion = new Date().toISOString().split('T')[0];
    setEspecificaciones(updated);
  };

  const handlePrintAction = async (action) => {
    setPdfLoadingState(action);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      // Mapear id del template preferido al string esperado por el backend
      let templateName = 'fleje3';
      if (templatePreferido === 1) templateName = 'a4';
      if (templatePreferido === 3) templateName = 'fleje2';

      // 1. Llamar al endpoint POST
      const response = await fetch(`${API_BASE_URL}/fichas/imprimir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sku: producto.sku,
          template: templateName,
          action: action === 'preview' ? 'preview' : 'print'
        })
      });

      if (response.status === 401 || response.status === 403) {
        if (onTokenExpired) {
          onTokenExpired();
        } else {
          localStorage.removeItem('userToken');
          localStorage.removeItem('userEmail');
          window.location.reload();
        }
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al generar el PDF de impresión.');
      }

      // 2. Leer la respuesta como Blob binario
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      if (action === 'preview') {
        // Abrir previsualización en pestaña nueva
        window.open(blobUrl, '_blank');
      } else {
        // Forzar descarga del archivo PDF en el dispositivo móvil/computadora
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `ficha_tecnica_${producto.sku}_${templateName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Liberar el objeto URL creado
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 1000);
      }
    } catch (err) {
      console.error('Error de impresión:', err);
      alert('Hubo un error al generar la ficha técnica: ' + err.message);
    } finally {
      setPdfLoadingState('idle');
    }
  };

  const addSpecification = () => {
    setEspecificaciones([...especificaciones, { 
      clave: '', 
      valor: '', 
      origen: 'Usuario', 
      fecha_validacion: new Date().toISOString().split('T')[0] 
    }]);
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
      eans: eans.filter(Boolean),
      estado: estado // Enviar el estado seleccionado en el editor
    };

    try {
      const response = await fetch(`${API_BASE_URL}/fichas/aprobar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401 || response.status === 403) {
        if (onTokenExpired) {
          onTokenExpired();
        } else {
          localStorage.removeItem('userToken');
          localStorage.removeItem('userEmail');
          window.location.reload();
        }
        return;
      }

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
      <div className="bg-gray-50 px-5 py-4 border-b border-gray-100 flex justify-between items-start">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-easy-red bg-red-50 px-2 py-0.5 rounded">
            Ficha Técnica
          </span>
          <h2 className="text-xl font-bold text-easy-dark mt-1">SKU {producto.sku}</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Badge de Estado P1.2 */}
          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
            getEstadoMetadata(estado).bg
          } ${
            getEstadoMetadata(estado).text
          }`}>
            {getEstadoMetadata(estado).label}
          </span>
          
          {/* Botón de Historial P0.6 */}
          {!isOffline && (
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-easy-red border border-gray-200 bg-white px-2 py-1 rounded-xl shadow-sm active:scale-95 transition-all"
            >
              <GitCommit className="w-3.5 h-3.5 text-easy-red" />
              <span>Ver Historial</span>
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-6">
        
        {/* Completitud de Ficha (P1.1) */}
        <CompletenessBar percentage={completeness} />

        {/* Alertas de Inconsistencias (P1.4) */}
        {inconsistencies.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Se detectaron {inconsistencies.length} alertas de calidad:</span>
            </div>
            <ul className="list-disc pl-5 text-amber-700/90 space-y-1 font-semibold">
              {inconsistencies.map((alert, idx) => (
                <li key={idx} className={alert.gravedad === 'alta' ? 'text-red-700 font-bold' : ''}>
                  {alert.mensaje}
                </li>
              ))}
            </ul>
          </div>
        )}
        
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
                disabled={loading || isReadOnly || isOffline}
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Ej. Stanley, Bosch"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all disabled:opacity-60 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Tipo de Herramienta</label>
              <input
                type="text"
                required
                disabled={loading || isReadOnly || isOffline}
                value={tipoHerramienta}
                onChange={(e) => setTipoHerramienta(e.target.value)}
                placeholder="Ej. Taladro, Caja Grapas"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all disabled:opacity-60 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Listado y Carga de EANs (Relación 1-a-N con Lector de Cámara) P1.4 */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5 text-gray-500" /> Códigos de Barras / EAN Asociados
            </label>
            
            {/* Pills de EANs actuales */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {eans.map((code, index) => (
                <span key={index} className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200 transition-colors">
                  <span>{code}</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEans(eans.filter((_, i) => i !== index))}
                      className="text-gray-400 hover:text-easy-red transition-colors ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
              {eans.length === 0 && (
                <span className="text-xs text-gray-400 font-semibold italic">Sin códigos EAN asociados</span>
              )}
            </div>

            {/* Input y Botón Scanner */}
            {canEdit && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    disabled={loading || isOffline}
                    value={newEanText}
                    onChange={(e) => setNewEanText(e.target.value.replace(/\D/g, ''))} // Solo permitir dígitos
                    placeholder="Escribir nuevo código EAN..."
                    className="w-full bg-white border border-gray-300 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newEanText.trim()) {
                          if (!eans.includes(newEanText.trim())) {
                            setEans([...eans, newEanText.trim()]);
                          }
                          setNewEanText('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setScanActiveForEan(true)}
                    className="absolute right-2 top-1.5 p-1 text-gray-400 hover:text-easy-red hover:bg-gray-50 rounded-md transition-colors"
                    title="Escanear con cámara"
                  >
                    <QrCode className="w-4 h-4 text-easy-red" />
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    if (newEanText.trim()) {
                      if (!eans.includes(newEanText.trim())) {
                        setEans([...eans, newEanText.trim()]);
                      }
                      setNewEanText('');
                    }
                  }}
                  className="bg-easy-dark text-white hover:bg-gray-800 font-bold px-3.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-center active:scale-95"
                >
                  Agregar
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1">
              <Image className="w-3.5 h-3.5 text-gray-500" /> URL de Imagen / Foto
            </label>
            <input
              type="url"
              disabled={loading || isReadOnly || isOffline}
              value={fotoUrl}
              onChange={(e) => setFotoUrl(e.target.value)}
              placeholder="https://ejemplo.com/foto.jpg"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all disabled:opacity-60 disabled:bg-gray-50"
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
              disabled={isReadOnly || isOffline}
              onClick={addSpecification}
              className="flex items-center gap-1 text-xs font-bold text-easy-red bg-red-50 hover:bg-red-100 active:scale-95 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar campo
            </button>
          </div>

          <div className="space-y-2">
            {especificaciones.map((spec, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  disabled={isReadOnly || isOffline}
                  value={spec.clave}
                  onChange={(e) => handleSpecChange(index, 'clave', e.target.value)}
                  placeholder="Atributo (ej. Potencia)"
                  className="flex-1 min-w-0 bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-easy-red focus:border-easy-red disabled:opacity-60 disabled:bg-gray-50"
                />
                <input
                  type="text"
                  disabled={isReadOnly || isOffline}
                  value={spec.valor}
                  onChange={(e) => handleSpecChange(index, 'valor', e.target.value)}
                  placeholder="Valor (ej. 750W)"
                  className="flex-1 min-w-0 bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-easy-red focus:border-easy-red disabled:opacity-60 disabled:bg-gray-50"
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

                <button
                  type="button"
                  disabled={isReadOnly || isOffline}
                  onClick={() => removeSpecification(index)}
                  className="p-2 text-gray-400 hover:text-easy-red hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
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

        {/* Sección: Estado de la Ficha (Ciclo de Vida P1.2) */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">Estado de la Ficha</label>
          <select
            disabled={isReadOnly || isOffline}
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all disabled:opacity-60 disabled:bg-gray-50 font-semibold text-gray-700"
          >
            <option value="BORRADOR">Borrador</option>
            <option value="GENERADA_POR_IA">Generada por IA</option>
            <option value="PENDIENTE_VALIDACION">Pendiente de Validación</option>
            <option value="APROBADA">Aprobada</option>
            <option value="OBSERVADA">Observada</option>
            <option value="DESACTUALIZADA">Desactualizada</option>
            <option value="VENCIDA">Vencida</option>
          </select>
        </div>

        {/* Sección: Aprobador (Local) */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">Aprobado Por (Nombre Operador)</label>
          <input
            type="text"
            required
            disabled={isReadOnly || isOffline}
            value={aprobadoPor}
            onChange={(e) => setAprobadoPor(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-easy-red focus:border-transparent transition-all disabled:opacity-60 disabled:bg-gray-50"
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
        {canEdit && (
          <button
            type="submit"
            disabled={loading || isOffline}
            className="w-full bg-easy-red hover:bg-red-700 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl shadow-md shadow-easy-red/25 hover:shadow-lg transition-all flex justify-center items-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Aprobar y Guardar Ficha'}
          </button>
        )}

        {/* Botones de Impresión y Vista Previa */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            type="button"
            disabled={pdfLoadingState !== 'idle' || loading || isOffline}
            onClick={() => handlePrintAction('preview')}
            className="bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-gray-700 font-bold py-3 rounded-xl border border-gray-200 transition-all flex justify-center items-center gap-1.5 text-xs disabled:opacity-50 disabled:pointer-events-none"
          >
            {pdfLoadingState === 'preview' ? (
              <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {pdfLoadingState === 'preview' ? 'Generando...' : 'Vista Previa'}
          </button>
          <button
            type="button"
            disabled={pdfLoadingState !== 'idle' || loading || isOffline}
            onClick={() => handlePrintAction('print')}
            className="bg-easy-yellow hover:bg-yellow-400 active:scale-[0.98] text-easy-dark font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-1.5 text-xs shadow-sm shadow-yellow-400/10 disabled:opacity-50 disabled:pointer-events-none"
          >
            {pdfLoadingState === 'print' ? (
              <RefreshCw className="w-4 h-4 animate-spin text-easy-dark" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            {pdfLoadingState === 'print' ? 'Descargando...' : 'Imprimir Ficha'}
          </button>
        </div>

      </form>

      {/* Modal del Comparador de Versiones P0.6 */}
      {isHistoryOpen && (
        <VersionComparatorModal
          sku={producto.sku}
          currentSpecs={{ marca, tipo_herramienta: tipoHerramienta, especificaciones }}
          currentFotoUrl={fotoUrl}
          token={token}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {/* Scanner de Cámara Local para agregar EANs (P1.4) */}
      {scanActiveForEan && (
        <Scanner
          onScanSuccess={(code) => {
            if (code) {
              const cleanCode = code.trim();
              if (cleanCode && !eans.includes(cleanCode)) {
                setEans([...eans, cleanCode]);
              }
            }
            setScanActiveForEan(false);
          }}
          onClose={() => setScanActiveForEan(false)}
        />
      )}
    </div>
  );
}
