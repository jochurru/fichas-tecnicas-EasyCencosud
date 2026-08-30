import React, { useState, useEffect } from 'react';
import { RefreshCw, UploadCloud, Layers, Filter } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { STORE_BLOCKS, ALL_SECTORS } from '../../config/storeBlocks';

// Mapeo canónico de marcas conocidas a sus bloques de tienda
const KNOWN_BRAND_BLOCK_MAP = {
  // Bloque 1: Técnico / Taller (Herramientas, Electricidad, Ferretería, Automotor)
  'bremen': 1, 'stanley': 1, 'blackdecker': 1, 'dewalt': 1, 'bosch': 1,
  'einhell': 1, 'daewoo': 1, 'robust': 1, 'herramientasrobust': 1, 'makita': 1,
  'gamma': 1, 'kushiro': 1, 'dowen pagio': 1, 'dowenpagio': 1, 'dremel': 1,
  'skil': 1, 'karcher': 1,

  // Bloque 2: Terminaciones / Obra (Pinturas, Plomería, Baños, Pisos, Maderas, Aberturas, Construcciones)
  'alba': 2, 'sherwin': 2, 'sherwin williams': 2, 'sinteplast': 2, 'plasti-kote': 2,
  'rustoleum': 2, 'ferrum': 2, 'roca': 2, 'tigre': 2, 'awaduct': 2, 'fv': 2,
  'weber': 2, 'klaukol': 2, 'loma negra': 2, 'sika': 2,

  // Bloque 3: Deco / Confort (Menaje y Deco, Iluminación, Deco Ventanas/Textil, Electro, Ampolletas)
  'philips': 3, 'osram': 3, 'candil': 3, 'liliana': 3, 'moulinex': 3,
  'oster': 3, 'peabody': 3, 'atma': 3,

  // Bloque 4: Hogar / Aire Libre (Muebles, Outdoor, Organizadores, Jardín y Mascotas)
  'tramontina': 4, 'colombraro': 4, 'keter': 4, 'mor': 4, 'coleman': 4
};

export default function DynamicBrandsTab({
  brands,
  setBrands,
  brandsLoading,
  setBrandsLoading,
  newBrandSlug,
  setNewBrandSlug,
  newBrandNombre,
  setNewBrandNombre,
  setErrorMsg,
  setSuccessMsg,
  token,
  currentUser
}) {
  const [selectedBlockFilter, setSelectedBlockFilter] = useState('ALL');

  const userRole = currentUser?.role || 'operador';
  const isGlobalAdmin = ['gerente', 'subadmin', 'admin', 'superadmin'].includes(userRole);

  const userBlock = userRole === 'jefe_sector'
    ? (STORE_BLOCKS.find(b => b.jefe_email.toLowerCase() === (currentUser?.email || '').toLowerCase()) || STORE_BLOCKS[0])
    : (STORE_BLOCKS.find(b => b.id === Number(currentUser?.bloque_id)) || STORE_BLOCKS[0]);

  const activeBlockId = isGlobalAdmin
    ? (selectedBlockFilter === 'ALL' ? null : Number(selectedBlockFilter))
    : userBlock.id;

  const filteredBrands = brands.filter((brand) => {
    if (!activeBlockId) return true;
    const cleanSlug = (brand.slug || '').toLowerCase().trim();
    const brandBlock = KNOWN_BRAND_BLOCK_MAP[cleanSlug] || brand.bloque_id || 1; // Default a bloque 1 si es genérica
    return brandBlock === activeBlockId;
  });
  const loadBrands = async () => {
    setBrandsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/marcas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Error ${res.status} al cargar marcas`);
      const data = await res.json();
      setBrands(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBrandsLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
  }, []);

  const compressAndUploadBrandLogo = async (file, slug, nombre) => {
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

          const dataUrl = canvas.toDataURL('image/webp', 0.8);
          
          fetch(`${API_BASE_URL}/upload/imagen`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              tipo: 'marca',
              id: slug,
              fileBase64: dataUrl,
              nombre
            })
          })
          .then(async (res) => {
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `Error ${res.status} al subir logo`);
            }
            return res.json();
          })
          .then(resolve)
          .catch(reject);
        };
        img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada'));
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
    });
  };

  return (
    <div className="space-y-6">
      {/* Formulario Nueva Marca */}
      <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-150 space-y-4">
        <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Cargar Nueva Marca</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">Nombre Visible (ej: DEWALT)</label>
            <input 
              type="text" 
              placeholder="Nombre de la Marca" 
              value={newBrandNombre}
              onChange={(e) => {
                const val = e.target.value;
                setNewBrandNombre(val);
                setNewBrandSlug(val.toLowerCase().replace(/[^a-z0-9]/g, ''));
              }}
              className="w-full text-xs font-semibold px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-easy-red bg-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">Slug / ID (Auto)</label>
            <input 
              type="text" 
              readOnly 
              value={newBrandSlug}
              className="w-full text-xs font-mono font-bold px-3 py-2 border border-gray-200 rounded-xl bg-gray-100 text-gray-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          {newBrandNombre.trim() ? (
            <label className="text-xs bg-easy-red hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4" />
              <span>Seleccionar Logo y Guardar</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setErrorMsg('');
                  setSuccessMsg('');
                  try {
                    await compressAndUploadBrandLogo(file, newBrandSlug, newBrandNombre);
                    setSuccessMsg(`✓ Marca "${newBrandNombre.toUpperCase()}" registrada correctamente.`);
                    setNewBrandNombre('');
                    setNewBrandSlug('');
                    await loadBrands();
                  } catch (err) {
                    setErrorMsg(err.message);
                  }
                }}
              />
            </label>
          ) : (
            <span className="text-[10px] text-gray-400 italic font-semibold">Ingresá el nombre para habilitar la carga</span>
          )}
        </div>
      </div>

      {/* Selector de Bloques para Gerencia y Subadministradores */}
      {isGlobalAdmin && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filtrar por Bloque:
          </span>
          <button
            onClick={() => setSelectedBlockFilter('ALL')}
            className={`text-xs px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
              selectedBlockFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todos ({brands.length})
          </button>
          {STORE_BLOCKS.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBlockFilter(b.id)}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                Number(selectedBlockFilter) === b.id
                  ? 'bg-easy-red text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {b.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Tabla Listado de Marcas */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
          <span className="text-xs font-bold text-gray-700">
            {isGlobalAdmin 
              ? `Catálogo de Marcas (${selectedBlockFilter === 'ALL' ? 'Toda la Tienda' : STORE_BLOCKS.find(b => b.id === Number(selectedBlockFilter))?.nombre})` 
              : `Marcas de tu Bloque (${userBlock.nombre})`}
          </span>
          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">Total: {filteredBrands.length}</span>
        </div>

        {brandsLoading ? (
          <div className="flex justify-center items-center py-10 text-gray-400 gap-1.5 text-xs font-bold">
            <RefreshCw className="w-4 h-4 animate-spin text-easy-red" /> Cargando marcas...
          </div>
        ) : filteredBrands.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs font-bold">
            No hay marcas registradas para este bloque todavía. Podés registrar una nueva arriba.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100/40 text-[9px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Slug (ID)</th>
                  <th className="px-4 py-2">Logotipo</th>
                  <th className="px-4 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-[11px]">
                {filteredBrands.map((brand, idx) => (
                  <tr key={brand.id || idx} className="hover:bg-gray-50/45">
                    <td className="px-4 py-3.5 font-bold text-gray-700 uppercase">
                      {brand.nombre}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-gray-500">
                      {brand.slug}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="bg-easy-dark/95 w-16 h-8 rounded-lg overflow-hidden flex items-center justify-center p-1 border border-gray-200">
                        <img 
                          src={brand.logo_url} 
                          alt={brand.nombre} 
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://placehold.co/60x30?text=Err';
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <label className="text-[10px] bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold px-2.5 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1">
                          <span>✏️ Sobreescribir</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setErrorMsg('');
                              setSuccessMsg('');
                              try {
                                await compressAndUploadBrandLogo(file, brand.slug, brand.nombre);
                                setSuccessMsg(`✓ Logotipo de "${brand.nombre.toUpperCase()}" actualizado.`);
                                await loadBrands();
                              } catch (err) {
                                setErrorMsg(err.message);
                              }
                            }}
                          />
                        </label>
                        <button
                          className="text-[10px] bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 font-bold px-2.5 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 inline-flex items-center gap-1"
                          onClick={async () => {
                            if (!window.confirm(`¿Estás seguro de eliminar la marca "${brand.nombre}"?`)) return;
                            setErrorMsg('');
                            setSuccessMsg('');
                            try {
                              const res = await fetch(`${API_BASE_URL}/marcas/${brand.slug}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                              });
                              if (!res.ok) throw new Error(`Error ${res.status}`);
                              setSuccessMsg(`✓ Marca "${brand.nombre.toUpperCase()}" eliminada.`);
                              await loadBrands();
                            } catch (err) {
                              setErrorMsg(err.message);
                            }
                          }}
                        >
                          🗑️ Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
