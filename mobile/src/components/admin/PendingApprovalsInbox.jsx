import React, { useState, useEffect } from 'react';
import { Inbox, CheckCircle, XCircle, Upload, AlertTriangle, FileText, Image as ImageIcon, Eye, User, Calendar, Tag, ShieldCheck, Sparkles, Layers, Award, Filter } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { STORE_BLOCKS, ALL_SECTORS, getSectorName, getBlockBySectorId } from '../../config/storeBlocks';

export default function PendingApprovalsInbox({ user }) {
  const [fichas, setFichas] = useState([]);
  const [brandsList, setBrandsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFicha, setSelectedFicha] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('vendedores'); // 'vendedores' | 'ia'
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [uploading, setUploading] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionSuccess, setActionSuccess] = useState(null);
  
  // Estado editable en el modal de inspección
  const [editableSpecs, setEditableSpecs] = useState([]);
  const [templatePreferido, setTemplatePreferido] = useState(1);

  const isBossOrAbove = ['gerente', 'subadmin', 'jefe_sector', 'coordinador'].includes(user?.role);

  const fetchPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/aprobaciones/pendientes`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.status === 401) {
        localStorage.removeItem('userToken');
        window.location.reload();
        return;
      }
      if (!res.ok) throw new Error(`Error al cargar la bandeja de aprobaciones (HTTP ${res.status}).`);
      const data = await res.json();
      setFichas(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    const token = localStorage.getItem('userToken');
    if (token) {
      fetch(`${API_BASE_URL}/marcas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setBrandsList(data);
      })
      .catch(err => console.error('Error fetching brands list:', err));
    }
  }, []);

  // Seleccionar ficha para inspección completa
  const openInspectModal = (ficha) => {
    setSelectedFicha(ficha);
    setPhotoUrlInput(ficha.foto_url || '');
    setTemplatePreferido(ficha.template_preferido || 1);
    
    // Extraer especificaciones del JSON
    const specsJson = ficha.especificaciones_json || {};
    const list = Array.isArray(specsJson.especificaciones) 
      ? specsJson.especificaciones 
      : (Array.isArray(ficha.especificaciones) ? ficha.especificaciones : []);
    
    setEditableSpecs(list.map(s => ({ clave: s.clave || '', valor: s.valor || '' })));
  };

  const handleApprove = async (fichaId) => {
    setError(null);
    try {
      const token = localStorage.getItem('userToken');
      
      // Reconstruir objeto de especificaciones actualizado
      const origJson = selectedFicha?.especificaciones_json || {};
      const updatedJson = {
        ...origJson,
        especificaciones: editableSpecs
      };

      const res = await fetch(`${API_BASE_URL}/aprobaciones/${fichaId}/aprobar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          foto_url: photoUrlInput || selectedFicha?.foto_url,
          especificaciones: updatedJson,
          template_preferido: templatePreferido
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aprobar ficha.');

      setActionSuccess('¡Ficha aprobada y publicada oficialmente!');
      setSelectedFicha(null);
      setPhotoUrlInput('');
      fetchPending();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async (fichaId) => {
    if (!rejectReason.trim()) {
      setError('Debe especificar un motivo de rechazo.');
      return;
    }
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/aprobaciones/${fichaId}/rechazar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ observaciones: rejectReason })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al rechazar ficha.');

      setActionSuccess('Ficha devuelta con observaciones.');
      setSelectedFicha(null);
      setRejectReason('');
      fetchPending();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedFicha) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('userToken');
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const base64Data = canvas.toDataURL('image/webp', 0.8);

          fetch(`${API_BASE_URL}/upload/imagen`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
              tipo: 'producto',
              id: selectedFicha.sku,
              fileBase64: base64Data
            })
          })
          .then(res => res.json())
          .then(data => {
            if (data.url) {
              setPhotoUrlInput(data.url);
            } else {
              alert(data.error || 'Error al subir la imagen');
            }
          })
          .catch(err => alert('Error subiendo imagen: ' + err.message))
          .finally(() => setUploading(false));
        };
        img.onerror = () => {
          alert('Archivo de imagen inválido.');
          setUploading(false);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Error subiendo imagen: ' + err.message);
      setUploading(false);
    }
  };

  // Filtrado de sub-pestañas: Vendedores vs IA
  const vendorPendingList = fichas.filter(f => f.estado === 'PENDIENTE_VALIDACION' || f.estado === 'pendiente_revision');
  const aiPendingList = fichas.filter(f => f.estado === 'GENERADA_POR_IA' || f.estado === 'generada_ia');
  
  const currentList = activeSubTab === 'vendedores' ? vendorPendingList : aiPendingList;

  // Obtener los sectores del bloque del usuario
  const userBlock = user?.role === 'jefe_sector' 
    ? (STORE_BLOCKS.find(b => b.jefe_email.toLowerCase() === (user.email || '').toLowerCase()) || STORE_BLOCKS[0])
    : (STORE_BLOCKS.find(b => b.id === Number(user?.bloque_id)) || STORE_BLOCKS[0]);

  const blockSectors = ['gerente', 'subadmin', 'admin', 'superadmin'].includes(user?.role)
    ? ALL_SECTORS
    : userBlock.sectores;

  // Filtrado por sector seleccionado
  const filteredFichas = fichas.filter(f => {
    if (selectedSector === 'ALL') return true;
    const fSector = Number(f.sector_id);
    return fSector === Number(selectedSector) || (Number(selectedSector) === 45 && fSector === 1);
  });

  if (!isBossOrAbove) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h4 className="font-bold text-slate-700">Acceso Restringido</h4>
        <p className="text-xs text-slate-400 mt-1">La bandeja de aprobaciones está reservada para Coordinadores, Jefes de Sector y Gerencia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans">
      {/* Header de la Bandeja */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-black text-slate-800 text-base flex items-center gap-2">
            <Inbox className="w-5 h-5 text-red-600" />
            <span>Bandeja de Pendientes — {userBlock.nombre}</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Fichas enviadas por vendedores de tu bloque que requieren validación técnica y foto oficial antes de ser impresas.
          </p>
        </div>
        
        <button
          onClick={fetchPending}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0"
        >
          <span>↻ Actualizar</span>
        </button>
      </div>

      {/* Selector / Filtro por Sector del Bloque */}
      {blockSectors.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Sectores:
          </span>
          <button
            onClick={() => setSelectedSector('ALL')}
            className={`text-xs px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
              selectedSector === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todos ({fichas.length})
          </button>
          {blockSectors.map((s) => {
            const count = fichas.filter(f => Number(f.sector_id) === s.id || (s.id === 45 && Number(f.sector_id) === 1)).length;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSector(s.id)}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                  Number(selectedSector) === s.id
                    ? 'bg-easy-red text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{s.nombre}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    Number(selectedSector) === s.id ? 'bg-white text-easy-red' : 'bg-red-100 text-red-700'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista de Fichas Enviadas por Vendedores */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs font-medium">Cargando solicitudes de vendedores...</div>
      ) : filteredFichas.length === 0 ? (
        <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-200 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h5 className="font-bold text-sm text-slate-700">¡Bandeja al día!</h5>
          <p className="text-xs text-slate-400 mt-1">
            No hay solicitudes de revisión pendientes en este sector.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFichas.map((f) => {
            const specData = f.especificaciones_json || {};
            const marca = specData.marca || f.marca || 'GENERICA';
            const tipoHerramienta = specData.tipo_herramienta || f.tipo_herramienta || f.nombre || 'Herramienta';
            const specsList = Array.isArray(specData.especificaciones) ? specData.especificaciones : [];
            const emisor = f.aprobado_por || f.creado_por || 'vendedor.herramientas@easy.com.ar';
            const sectorNombre = getSectorName(f.sector_id);

            return (
              <div key={f.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        f.estado === 'PENDIENTE_VALIDACION' || f.estado === 'pendiente_revision'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}>
                        {f.estado === 'PENDIENTE_VALIDACION' || f.estado === 'pendiente_revision'
                          ? '⌛ Revisión Vendedor' 
                          : '🤖 Borrador IA'}
                      </span>
                      <span className="text-[10px] font-extrabold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        {sectorNombre}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      SKU {f.sku}
                    </span>
                  </div>

                  <h5 className="font-bold text-base text-slate-800 line-clamp-1">{tipoHerramienta}</h5>
                  <p className="text-xs text-red-600 font-extrabold uppercase tracking-wide">{marca}</p>

                  {/* Datos del Envíador */}
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Enviado por: <strong className="text-slate-700">{emisor}</strong></span>
                  </div>

                  {/* Previsualización de Especificaciones */}
                  <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                      Especificaciones ({specsList.length}):
                    </span>
                    {specsList.slice(0, 3).map((spec, i) => (
                      <div key={i} className="truncate text-slate-700 font-medium">
                        <strong className="font-bold text-slate-900">{spec.clave}:</strong> {spec.valor}
                      </div>
                    ))}
                    {specsList.length > 3 && (
                      <div className="text-[10px] text-slate-400 font-bold italic pt-1">
                        + {specsList.length - 3} atributos adicionales...
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => openInspectModal(f)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20 transition active:scale-95"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Revisar Ficha Completa</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Inspección Detallada y Edición por el Coordinador */}
      {selectedFicha && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col font-sans">
            
            {/* Header del Modal */}
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-widest bg-red-950 px-2 py-0.5 rounded">
                  Inspección y Validación
                </span>
                <h4 className="font-black text-base mt-0.5">
                  {selectedFicha.especificaciones_json?.marca || selectedFicha.marca} - SKU {selectedFicha.sku}
                </h4>
              </div>
              <button 
                onClick={() => setSelectedFicha(null)} 
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo de Inspección Detallada */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              
              {/* Card Infobox: Creador y Estado */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block text-[11px]">Enviado por el usuario:</span>
                  <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mt-0.5">
                    <User className="w-4 h-4 text-red-600" />
                    {selectedFicha.aprobado_por || selectedFicha.creado_por || 'vendedor.herramientas@easy.com.ar'}
                  </span>
                </div>

                <div className="sm:text-right">
                  <span className="text-slate-400 font-medium block text-[11px]">Última modificación:</span>
                  <span className="font-bold text-slate-700 flex items-center sm:justify-end gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(selectedFicha.updated_at || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Asignación de Foto Oficial */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <label className="block text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-red-600" />
                  <span>Foto Oficial de Producto (Visible en Ficha e Impresión)</span>
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {(photoUrlInput || selectedFicha.foto_url) ? (
                    <div className="relative group shrink-0">
                      <img 
                        src={photoUrlInput || selectedFicha.foto_url} 
                        alt="Foto Oficial" 
                        className="w-24 h-24 object-contain bg-white rounded-xl border border-slate-200 p-2 shadow-sm" 
                      />
                      <span className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-1 shadow">
                        <CheckCircle className="w-4 h-4" />
                      </span>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-[10px] text-center p-2 shrink-0">
                      <span>Sin Foto Oficial</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-2 w-full">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer w-full"
                    />
                    <p className="text-[11px] text-slate-400">
                      Podés subir la foto sacada desde la góndola o cargar una URL directa.
                    </p>
                    {uploading && <span className="text-xs text-red-600 font-bold block animate-pulse">Subiendo foto oficial a Supabase Storage...</span>}
                  </div>
                </div>
              </div>

              {/* Revisión del Logotipo de la Marca */}
              {(() => {
                const specData = selectedFicha?.especificaciones_json || {};
                const marca = specData.marca || selectedFicha?.marca || '';
                const cleanBrandSlug = (marca || '').toLowerCase().trim().replace(/[^a-z0-9-_]/g, '');
                const currentBrandObj = brandsList.find(b => b.slug === cleanBrandSlug);

                const brandLogoMap = {
                  'einhell': 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Einhell_Germany_logo.svg',
                  'bosch': 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Bosch-Logo.svg',
                  'dewalt': 'https://upload.wikimedia.org/wikipedia/commons/8/89/DeWalt_Logo.svg',
                  'stanley': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Stanley_Black_%26_DeCKER_logo.svg',
                  'black & decker': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Stanley_Black_%26_DeCKER_logo.svg',
                  'black+decker': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Stanley_Black_%26_DeCKER_logo.svg',
                  'makita': 'https://upload.wikimedia.org/wikipedia/commons/7/71/Makita_Logo.svg',
                  'karcher': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/K%C3%A4rcher_Logo_2015.svg',
                  'dremel': 'https://upload.wikimedia.org/wikipedia/commons/7/79/Dremel_logo.svg',
                  'skil': 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Skil_logo_2019.svg',
                  'gamma': 'https://gammaherramientas.com.ar/wp-content/uploads/2016/09/LogoGamma.png',
                  'kushiro': 'https://kushiro.com.ar/img/logo-kushiro.png',
                  'dowen pagio': 'https://www.dowenpagio.com.ar/wp-content/themes/dowen-pagio/images/logo.png'
                };

                let resolvedLogoUrl = currentBrandObj?.logo_url || null;
                if (!resolvedLogoUrl) {
                  for (const key of Object.keys(brandLogoMap)) {
                    if (cleanBrandSlug.includes(key)) {
                      resolvedLogoUrl = brandLogoMap[key];
                      break;
                    }
                  }
                }

                return (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-red-600" />
                        <span>Logotipo de Marca ("{marca.toUpperCase() || 'GENÉRICA'}")</span>
                      </label>
                      {resolvedLogoUrl ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Logo Registrado
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold uppercase">
                          Logo Faltante (Texto Plano)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3.5">
                      <div className="bg-slate-900 w-24 h-12 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-200 shrink-0 shadow-inner">
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
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase select-none text-center">Sin Logo</span>
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          {resolvedLogoUrl 
                            ? 'Este logotipo oficial se imprimirá en el encabezado de las cartelas y flejes de todos los productos de esta marca.' 
                            : 'Esta marca no posee logotipo registrado aún. En la impresión se mostrará el nombre en texto.'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tabla Editable de Todas las Especificaciones */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h5 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-red-600" />
                    <span>Especificaciones Técnicas Sugeridas ({editableSpecs.length})</span>
                  </h5>
                  <span className="text-[10px] text-slate-400 font-medium">Podés editar cualquier valor antes de aprobar</span>
                </div>

                <div className="space-y-2">
                  {editableSpecs.map((spec, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={spec.clave}
                          onChange={(e) => {
                            const updated = [...editableSpecs];
                            updated[i].clave = e.target.value;
                            setEditableSpecs(updated);
                          }}
                          className="w-full text-xs font-bold text-slate-800 px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:outline-none bg-white"
                        />
                      </div>
                      <div className="col-span-7">
                        <input
                          type="text"
                          value={spec.valor}
                          onChange={(e) => {
                            const updated = [...editableSpecs];
                            updated[i].valor = e.target.value;
                            setEditableSpecs(updated);
                          }}
                          className="w-full text-xs font-medium text-slate-700 px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:outline-none bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alerta de Sanitización de Fotos */}
              <div className="bg-amber-50/90 border border-amber-200 p-3.5 rounded-xl text-amber-900 text-xs font-medium space-y-1.5 shadow-sm">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Política de Almacenamiento Limpio (1 Foto por SKU):</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  • <strong>Al Aprobar:</strong> La foto seleccionada será la única versión oficial activa. Si existía una foto anterior en el servidor, se eliminará permanentemente.
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  • <strong>Al Devolver:</strong> Si rechazas la propuesta, la foto subida por el vendedor se borrará automáticamente del servidor para evitar archivos basura o no deseados.
                </p>
              </div>

              {/* Formulario de Rechazo / Observaciones */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <label className="block text-xs font-extrabold text-slate-800">
                  Motivo de Devolución / Observaciones (Requerido solo si devuelves la ficha)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ej: Favor corregir el tipo de encastre o adjuntar foto con mejor iluminación..."
                  rows={2}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500/20 focus:outline-none bg-white"
                />
              </div>

            </div>

            {/* Footer de Acciones */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => handleReject(selectedFicha.id)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                ✕ Devolver con Observaciones
              </button>

              <button
                onClick={() => handleApprove(selectedFicha.id)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>✓ Aprobar y Publicar Oficialmente</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
