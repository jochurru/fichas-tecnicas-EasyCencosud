import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Save, FileText, CheckCircle, AlertCircle, 
  Image, Layers, Eye, Printer, RefreshCw, GitCommit, ShieldAlert,
  HelpCircle, QrCode, X, Award
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import CompletenessBar from './CompletenessBar';
import VersionComparatorModal from './VersionComparatorModal';
import Scanner from './Scanner';
import ImageUploadSection from './editor/ImageUploadSection';
import SpecsEditorList from './editor/SpecsEditorList';
import { savePrintQueueItem } from '../lib/indexedDb';
import { calculateCompleteness, detectInconsistencies, getEstadoMetadata } from '../lib/dataQuality';

export default function FichaEditor({ data, token, userEmail, userRole, onSaveSuccess, onTokenExpired }) {
  const { producto, ficha_tecnica } = data;
  const specData = ficha_tecnica?.especificaciones_json || {};
  const isOffline = data?.origen === 'local_offline';
  // Roles y Permisos de Tienda
  const isOperador = userRole === 'operador' || userRole === 'operator';
  const canUploadPhoto = true; // El vendedor puede proponer/subir la foto que será revisada por el encargado
  const canEdit = true; // Todos los empleados pueden sugerir correcciones y editar especificaciones
  const isReadOnly = false;

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
  const [addedToQueueStatus, setAddedToQueueStatus] = useState(false);
  const [showQueueToast, setShowQueueToast] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [brandLogoUploading, setBrandLogoUploading] = useState(false);
  
  // Feedback
  const [loading, setLoading] = useState(false);
  const [pdfLoadingState, setPdfLoadingState] = useState('idle'); // 'idle' | 'preview' | 'print'
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [brandSlugsWithLogos, setBrandSlugsWithLogos] = useState([]);
  const [brandsList, setBrandsList] = useState([]);

  // Cargar las marcas con logos dinámicos registrados
  useEffect(() => {
    if (token) {
      fetch(`${API_BASE_URL}/marcas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBrandsList(data);
          setBrandSlugsWithLogos(data.map(b => b.slug));
        }
      })
      .catch(err => console.error('Error fetching brands for validation:', err));
    }
  }, [token, brandLogoUploading]); // Se recarga si se sube un nuevo logo de marca al vuelo

  // Comprimir y subir imagen a Supabase Storage via backend WebP Canvas
  const compressAndUploadImage = async (file, tipo, targetId) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convertir a WebP con calidad 0.8
          const dataUrl = canvas.toDataURL('image/webp', 0.8);
          
          fetch(`${API_BASE_URL}/upload/imagen`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              tipo,
              id: targetId,
              fileBase64: dataUrl,
              nombre: tipo === 'marca' ? targetId : undefined
            })
          })
          .then(async (res) => {
            const resData = await res.json();
            if (!res.ok) {
              throw new Error(resData.error || 'Error al subir la imagen');
            }
            resolve(resData.url);
          })
          .catch(reject);
        };
        img.onerror = () => reject(new Error('Error al procesar la imagen'));
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
    });
  };

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
    const score = calculateCompleteness(producto, tempFicha, brandSlugsWithLogos);
    const alerts = detectInconsistencies(producto, tempFicha, [], brandSlugsWithLogos);
    
    setCompleteness(score);
    setInconsistencies(alerts);
  }, [marca, tipoHerramienta, especificaciones, fotoUrl, eans, producto, brandSlugsWithLogos]);

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

      const filename = `ficha_tecnica_${producto.sku}_${templateName}.pdf`;

      if (action === 'preview') {
        // Abrir previsualización en pestaña nueva
        window.open(blobUrl, '_blank');
      } else {
        // Forzar descarga del archivo PDF en el dispositivo móvil/computadora
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Notificación flotante global
        window.dispatchEvent(new CustomEvent('pdf-downloaded', {
          detail: {
            url: blobUrl,
            blob,
            filename,
            title: `Ficha SKU ${producto.sku} (${templateName.toUpperCase()})`
          }
        }));
      }
    } catch (err) {
      console.error('Error de impresión:', err);
      alert('Hubo un error al generar la ficha técnica: ' + err.message);
    } finally {
      setPdfLoadingState('idle');
    }
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

      setSuccessMsg(isOperador ? '¡Ficha enviada a la bandeja de revisión del encargado!' : 'Ficha técnica aprobada y guardada con éxito.');
      setTimeout(() => {
        onSaveSuccess(result.ficha_tecnica, eans.filter(Boolean));
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

          {/* Caja Destacada: Gestor de Logotipo de Marca P1.21 */}
          {canEdit && !isOffline && (() => {
            const cleanBrandSlug = marca.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '');
            const currentBrandObj = brandsList.find(b => b.slug === cleanBrandSlug);
            const brandLogoMap = {
              'einhell': 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Einhell_Germany_logo.svg',
              'bosch': 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Bosch-Logo.svg',
              'dewalt': 'https://upload.wikimedia.org/wikipedia/commons/8/89/DeWalt_Logo.svg',
              'stanley': 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Stanley_Hand_Tools_logo.svg',
              'black & decker': 'https://upload.wikimedia.org/wikipedia/commons/1/10/Black_%26_Decker_logo.svg',
              'black and decker': 'https://upload.wikimedia.org/wikipedia/commons/1/10/Black_%26_Decker_logo.svg',
              'b&d': 'https://upload.wikimedia.org/wikipedia/commons/1/10/Black_%26_Decker_logo.svg',
              'makita': 'https://upload.wikimedia.org/wikipedia/commons/7/71/Makita_Logo.svg',
              'karcher': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/K%C3%A4rcher_Logo_2015.svg',
              'dremel': 'https://upload.wikimedia.org/wikipedia/commons/7/79/Dremel_logo.svg',
              'skil': 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Skil_logo_2019.svg',
              'gamma': 'https://gammaherramientas.com.ar/wp-content/uploads/2016/09/LogoGamma.png',
              'kushiro': 'https://kushiro.com.ar/img/logo-kushiro.png',
              'dowen pagio': 'https://www.dowenpagio.com.ar/wp-content/themes/dowen-pagio/images/logo.png'
            };

            let resolvedLogoUrl = null;
            if (currentBrandObj) {
              resolvedLogoUrl = currentBrandObj.logo_url;
            } else {
              for (const key of Object.keys(brandLogoMap)) {
                if (cleanBrandSlug.includes(key)) {
                  resolvedLogoUrl = brandLogoMap[key];
                  break;
                }
              }
            }

            return (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                    <Award className="w-4 h-4 text-easy-red" />
                    <span>Logotipo para "{marca.toUpperCase() || 'MARCA SIN ESPECIFICAR'}"</span>
                  </div>
                  {resolvedLogoUrl ? (
                    <span className="text-[9px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold uppercase">
                      Logo Registrado
                    </span>
                  ) : (
                    <span className="text-[9px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold uppercase">
                      Logo Faltante (Texto)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="bg-easy-dark/95 w-20 h-10 rounded-xl overflow-hidden flex items-center justify-center p-1.5 border border-gray-200 shrink-0">
                    {resolvedLogoUrl ? (
                      <img
                        src={resolvedLogoUrl}
                        alt={marca}
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://placehold.co/60x30?text=Logo';
                        }}
                      />
                    ) : (
                      <span className="text-[9px] text-gray-400 font-extrabold uppercase select-none text-center">Sin Logo</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                      {resolvedLogoUrl 
                        ? 'Los carteles generados para esta marca mostrarán el logotipo que se ve a la izquierda.' 
                        : 'Esta marca no posee logotipo. Se imprimirá el nombre en texto plano en la cabecera.'}
                    </p>
                    
                    {marca.trim() ? (
                      <label className="text-[10.5px] font-bold text-easy-red hover:text-red-700 flex items-center gap-1 cursor-pointer select-none w-fit">
                        {brandLogoUploading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>✏️ {resolvedLogoUrl ? 'Sobreestablecer Logotipo' : 'Cargar Logotipo Oficial'}</span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={brandLogoUploading}
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setBrandLogoUploading(true);
                            try {
                              const cleanSlug = marca.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '');
                              await compressAndUploadImage(file, 'marca', cleanSlug);
                              alert(`✓ Logotipo para la marca "${marca.toUpperCase()}" actualizado con éxito.`);
                              try { if (navigator.vibrate) navigator.vibrate(50); } catch (vErr) {}
                            } catch (err) {
                              alert(err.message);
                            } finally {
                              setBrandLogoUploading(false);
                            }
                          }}
                        />
                      </label>
                    ) : (
                      <p className="text-[10px] text-amber-600 font-bold italic">
                        Ingresá un nombre de marca arriba para cargar su logo
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

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

          <ImageUploadSection
            sku={producto.sku}
            fotoUrl={fotoUrl}
            setFotoUrl={setFotoUrl}
            sugerenciaImagen={sugerenciaImagen}
            setErrorMsg={setErrorMsg}
            setSuccessMsg={setSuccessMsg}
            token={token}
          />

          <SpecsEditorList
            especificaciones={especificaciones}
            setEspecificaciones={setEspecificaciones}
            isReadOnly={isReadOnly}
            isOffline={isOffline}
          />
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

        {/* Sección: Estado de la Ficha (Solo visible para coordinadores y gerencia) */}
        {!isOperador && (
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Estado de la Ficha</label>
            <select
              disabled={isOffline}
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
        )}

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
            {loading ? 'Procesando...' : (isOperador ? '📤 Enviar a Revisión al Encargado' : '✓ Aprobar y Publicar Ficha')}
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

        {/* Botón para agregar a la cola local P1.21 */}
        {!isOffline && (
          <button
            type="button"
            onClick={async () => {
              const cleanSpecs = especificaciones.filter(
                (spec) => spec.clave.trim() !== '' || spec.valor.trim() !== ''
              );
              
              const item = {
                sku: producto.sku,
                descripcion: producto.descripcion,
                foto_url: fotoUrl || '',
                marca: marca || 'GENERICA',
                tipo_herramienta: tipoHerramienta || 'HERRAMIENTA',
                especificaciones_json: {
                  marca,
                  tipo_herramienta: tipoHerramienta,
                  especificaciones: cleanSpecs
                },
                template: templatePreferido === 1 ? 'a4' : templatePreferido === 2 ? 'fleje3' : 'fleje2',
                cantidad: 1
              };
              
              await savePrintQueueItem(item);
              window.dispatchEvent(new Event('print-queue-updated'));
              
              // Alertas táctiles
              try {
                if (navigator.vibrate) {
                  navigator.vibrate(50);
                }
              } catch (e) {}

              // Mostrar Toast inferior y transición de estado del botón
              setAddedToQueueStatus(true);
              setShowQueueToast(true);
              
              setTimeout(() => {
                setAddedToQueueStatus(false);
              }, 1500);
              
              setTimeout(() => {
                setShowQueueToast(false);
              }, 2500);
            }}
            className={`w-full text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-1.5 text-xs shadow-sm mt-3 active:scale-[0.98] select-none ${
              addedToQueueStatus 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-easy-dark hover:bg-gray-800'
            }`}
          >
            <Plus className="w-4 h-4 text-white" />
            <span>{addedToQueueStatus ? '✓ ¡Agregado!' : 'Agregar a Cola de Impresión'}</span>
          </button>
        )}

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

      {/* Toast no bloqueante P1.21 */}
      {showQueueToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-easy-dark/95 backdrop-blur-sm text-white px-5 py-3 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2.5 z-50 animate-fade-in border border-white/10 select-none">
          <span className="text-green-500 text-sm">✓</span>
          <span>Producto {producto.sku} agregado a la cola</span>
        </div>
      )}
    </div>
  );
}
