import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { API_BASE_URL } from '../config';

// Caché global en memoria para evitar latencias HTTP repetidas en cada apertura de modal
let cachedMarcasList = null;

export default function FichaPreviewModal({ sku, currentSpecs, currentFotoUrl, templateName = 'fleje3', onClose }) {
  const { marca = 'GENÉRICA', tipo_herramienta = 'HERRAMIENTA', especificaciones = [] } = currentSpecs || {};
  const [dynamicLogoUrl, setDynamicLogoUrl] = useState(null);
  const [logoFailed, setLogoFailed] = useState(false);

  // Logo de marcas (Fallback estático en caso de no estar en DB)
  const brandLogoMap = {
    'einhell': 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Einhell_Germany_logo.svg',
    'bosch': 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Bosch-Logo.svg',
    'dewalt': 'https://upload.wikimedia.org/wikipedia/commons/8/89/DeWalt_Logo.svg',
    'stanley': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Stanley_Black_%26_DeCKER_logo.svg',
    'black & decker': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Stanley_Black_%26_DeCKER_logo.svg',
    'black and decker': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Stanley_Black_%26_DeCKER_logo.svg',
    'black+decker': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Stanley_Black_%26_DeCKER_logo.svg',
    'b&d': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Stanley_Black_%26_DeCKER_logo.svg',
    'makita': 'https://upload.wikimedia.org/wikipedia/commons/9/91/Makita_logo.svg',
    'karcher': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/K%C3%A4rcher_Logo_2015.svg',
    'kärcher': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/K%C3%A4rcher_Logo_2015.svg',
    'dremel': 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Dremel_Logo.svg',
    'skil': 'https://upload.wikimedia.org/wikipedia/commons/6/66/Skil_Logo.svg',
    'gamma': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Gamma_logo.svg/320px-Gamma_logo.svg.png',
    'kushiro': 'https://kushiro.com.ar/img/logo-kushiro.png',
    'dowen pagio': 'https://www.dowenpagio.com.ar/wp-content/themes/dowen-pagio/images/logo.png',
    'daewoo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Daewoo-logo.svg/1200px-Daewoo-logo.svg.png'
  };

  const rawBrand = (marca || '').trim();
  const normBrand = rawBrand.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const cleanBrand = normBrand.replace(/[^a-z0-9]/g, '');

  // Consultar marcas dinámicas (con caché instantáneo)
  useEffect(() => {
    let isMounted = true;

    const applyFromList = (list) => {
      if (!Array.isArray(list)) return;
      const matched = list.find(b => {
        const bSlug = (b.slug || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const bName = (b.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const bSlugClean = bSlug.replace(/[^a-z0-9]/g, '');
        const bNameClean = bName.replace(/[^a-z0-9]/g, '');

        return (
          bSlug === normBrand ||
          bName === normBrand ||
          (cleanBrand && bSlugClean && (cleanBrand.includes(bSlugClean) || bSlugClean.includes(cleanBrand))) ||
          (cleanBrand && bNameClean && (cleanBrand.includes(bNameClean) || bNameClean.includes(cleanBrand)))
        );
      });
      if (matched && matched.logo_url && isMounted) {
        setDynamicLogoUrl(matched.logo_url);
      }
    };

    if (cachedMarcasList) {
      applyFromList(cachedMarcasList);
      return;
    }

    const fetchDynamicBrand = async () => {
      try {
        const token = localStorage.getItem('userToken');
        const res = await fetch(`${API_BASE_URL}/marcas`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const marcasList = await res.json();
          cachedMarcasList = marcasList;
          applyFromList(marcasList);
        }
      } catch (err) {
        console.warn('[FichaPreviewModal] Error al obtener logo dinámico:', err);
      }
    };
    fetchDynamicBrand();
    return () => { isMounted = false; };
  }, [marca, normBrand, cleanBrand]);

  let staticLogoUrl = null;
  for (const key of Object.keys(brandLogoMap)) {
    const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const cleanKey = normKey.replace(/[^a-z0-9]/g, '');
    if (normBrand.includes(normKey) || (cleanBrand && cleanKey && cleanBrand.includes(cleanKey))) {
      staticLogoUrl = brandLogoMap[key];
      break;
    }
  }

  const logoUrl = dynamicLogoUrl || staticLogoUrl;

  const esElectrico = especificaciones.some(s => {
    const claveLower = (s.clave || '').toLowerCase();
    const valorLower = (s.valor || '').toLowerCase();
    return claveLower.includes('voltaje') || claveLower.includes('potencia') || 
           claveLower.includes('watts') || claveLower.includes('motor') ||
           claveLower.includes('batería') || claveLower.includes('bateria') ||
           claveLower.includes('amperaje') || claveLower.includes('amp') ||
           valorLower.includes('brushless') || valorLower.includes('brushed') ||
           valorLower.match(/\d+\s*v\b/) || valorLower.match(/\d+\s*w\b/);
  });

  const potenciaSpec = especificaciones.find(s => 
    s.clave.toLowerCase().includes('potencia') || 
    s.clave.toLowerCase().includes('voltaje') ||
    s.clave.toLowerCase().includes('capacidad')
  );
  const destacado = potenciaSpec ? potenciaSpec.valor : '';

  const origenSpec = especificaciones.find(s => (s.clave || '').toLowerCase().includes('origen') || (s.clave || '').toLowerCase().includes('país'));
  const origenVal = (origenSpec && origenSpec.valor && origenSpec.valor.trim() !== '-') ? origenSpec.valor.trim().toUpperCase() : null;

  const garantiaSpec = especificaciones.find(s => (s.clave || '').toLowerCase().includes('garant'));
  const garantiaVal = (garantiaSpec && garantiaSpec.valor && garantiaSpec.valor.trim() !== '-') ? garantiaSpec.valor.trim().toUpperCase() : null;
  const garantiaMatch = garantiaVal ? garantiaVal.match(/(\d+)/) : null;
  const garantiaNumero = garantiaMatch ? garantiaMatch[1] : null;

  // Filtrar atributos del cuerpo excluyendo Garantía y Origen (que tienen celdas dedicadas en el footer)
  const bodySpecs = especificaciones.filter(s => {
    const k = (s.clave || '').toLowerCase();
    return !k.includes('garant') && !k.includes('origen') && !k.includes('país');
  });

  const brandLower = normBrand;
  const words = (tipo_herramienta || '').trim().split(' ');
  const isKitOrCombo = ['SET', 'KIT', 'COMBO'].includes((words[0] || '').toUpperCase());
  const tituloLinea1 = isKitOrCombo ? words.slice(0, 2).join(' ') : (words[0] || 'HERRAMIENTA');
  const tituloLinea2 = isKitOrCombo ? words.slice(2).join(' ') : words.slice(1).join(' ');
  const mostrarPill = esElectrico && destacado;
  const destacadoParts = (destacado || '').split(' ');
  const destacadoVal = destacadoParts[0] || '';
  const destacadoLbl = destacadoParts.slice(1).join(' ') || '';

  // Dimensiones en pantalla y clases específicas (Fleje 3 = ratio 100/70 = 1.4286)
  let widthClass = 'w-[350px]';
  let heightClass = 'h-[245px]';
  if (templateName === 'a4') {
    widthClass = 'w-[320px]';
    heightClass = 'h-[450px]';
  } else if (templateName === 'fleje2') {
    widthClass = 'w-[360px]';
    heightClass = 'h-[180px]';
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Vista Previa de Ficha Técnica</h3>
            <p className="text-xs text-gray-500 font-medium">SKU: {sku} • Plantilla: {templateName.toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-gray-100/60">
          {templateName === 'fleje3' && (
            brandLower.includes('robust') ? (
              /* ROBUST MASTER TEMPLATE PREVIEW (100x70mm) */
              <div className={`${widthClass} ${heightClass} bg-[#5d6368] text-white shadow-xl border-2 border-dashed border-white flex p-3 text-left relative font-sans select-none overflow-hidden justify-between`}>
                <div className="w-[48%] flex flex-col justify-between z-10 overflow-hidden">
                  <div>
                    {/* Logo ROBUST de alta precisión */}
                    <div className="mb-1 max-h-5 flex items-center">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Robust" className="max-h-5 max-w-[90px] object-contain" />
                      ) : (
                        <span className="font-black text-xs tracking-wider uppercase text-white">ROBUST</span>
                      )}
                    </div>

                    {/* Título en 2 líneas */}
                    <div className="mb-1 leading-tight">
                      <div className="font-black text-[10px] uppercase text-white tracking-wide truncate">{tituloLinea1}</div>
                      {tituloLinea2 && <div className="font-bold text-[8px] uppercase text-white tracking-wide truncate">{tituloLinea2}</div>}
                    </div>

                    {/* Highlight Pill */}
                    {mostrarPill && (
                      <div className="inline-flex items-center border border-white/90 rounded px-1.5 py-0.5 text-[7px] font-bold mb-1 w-fit">
                        <span className="text-white">{destacadoVal}</span>
                        <span className="text-white mx-0.5">⚡</span>
                        <span className="text-[#00c3e6] font-extrabold">{destacadoLbl}</span>
                      </div>
                    )}

                    {/* Especificaciones */}
                    <ul className="space-y-0.5 w-full">
                      {bodySpecs.slice(0, 6).map((spec, i) => (
                        <li key={i} className="text-[7px] font-medium text-white flex items-start leading-tight">
                          <span className="text-white font-black mr-1 text-[7px] leading-none shrink-0">•</span>
                          <span className="truncate"><strong>{spec.clave}:</strong> {spec.valor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pie Inferior Izquierdo: SKU y Metadatos */}
                  <div className="mt-auto pt-1">
                    <div className="border-t border-b border-white py-0.5 w-fit pr-3">
                      <span className="text-[7.5px] font-bold text-white tracking-wider">SKU: {sku}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 mt-0.5 text-[6.5px] font-bold text-white/90 uppercase tracking-wide">
                      <span>ORIGEN: {origenVal || 'S/D'}</span>
                      <span>GARANTÍA: {garantiaVal || (esElectrico ? '5 AÑOS' : '6 MESES')}</span>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Foto y Sello sin sobreposición */}
                <div className="w-[48%] flex flex-col justify-center items-center relative p-1">
                  <img src={currentFotoUrl || 'https://placehold.co/200?text=Sin+Foto'} alt="Foto" className="max-w-full max-h-[85%] object-contain" />
                  {/* Sello de Garantía dinámico */}
                  {esElectrico && !garantiaVal && (
                    <img
                      src="/sello_garantia_5_anos.png"
                      alt="5 Años de Garantía"
                      className="absolute right-0 bottom-0 w-8 h-8 object-contain z-20"
                    />
                  )}
                </div>
              </div>
            ) : (
              /* ========================================================================= */
              /* PLANTILLA ESTÁNDAR (Fleje 3: 100x70mm)                                   */
              /* ========================================================================= */
              <div className={`${widthClass} ${heightClass} bg-white text-gray-900 shadow-xl border border-gray-300 rounded-lg flex flex-col justify-between overflow-hidden relative font-sans select-none`}>
                {/* Header */}
                <div className="bg-[#222222] text-white h-[52px] px-3 py-1.5 flex justify-between items-center shrink-0">
                  <div className="max-w-[63%] flex flex-col justify-center text-left">
                    <span className="font-black text-xs uppercase leading-tight truncate">{tipo_herramienta}</span>
                    {destacado && <span className="text-[9.5px] font-bold text-[#ffed00] leading-none mt-0.5 truncate">{destacado}</span>}
                  </div>
                  <div className="max-w-[35%] text-right flex flex-col justify-center items-end">
                    {logoUrl && !logoFailed ? (
                      <img src={logoUrl} alt={marca} onError={() => setLogoFailed(true)} className="h-5 max-w-full object-contain" />
                    ) : (
                      <span className="font-black text-[10px] uppercase truncate text-white">{marca}</span>
                    )}
                    <span className="text-[8px] text-white font-extrabold tracking-wider leading-none mt-0.5">SAP {sku}</span>
                  </div>
                </div>

                {/* Body Grid */}
                <div className="flex-1 flex border-b border-[#cbd5e1] min-h-0 bg-white">
                  {/* Columna Izquierda: Viñetas rojas */}
                  <div className="w-[46%] bg-[#f8fafc] border-r border-[#cbd5e1] p-2 flex flex-col justify-center overflow-hidden text-left">
                    <ul className="space-y-1 w-full">
                      {bodySpecs.slice(0, 7).map((spec, i) => (
                        <li key={i} className="text-[7.5px] font-medium text-[#0f172a] flex items-start leading-tight">
                          <span className="text-[#e30613] font-black mr-1 text-[8px] leading-none shrink-0">▪</span>
                          <span className="truncate"><strong>{spec.clave}:</strong> {spec.valor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Columna Derecha: Foto del producto */}
                  <div className="w-[54%] p-1.5 flex items-center justify-center bg-white">
                    <img src={currentFotoUrl || 'https://placehold.co/150?text=Sin+Foto'} alt="Foto" className="max-h-full max-w-full object-contain" />
                  </div>
                </div>

                {/* Footer */}
                <div className="h-[28px] bg-[#f1f5f9] flex divide-x divide-[#cbd5e1] text-[8px] font-bold text-gray-800 shrink-0">
                  <div className="flex-1 flex items-center justify-center gap-1.5 text-center">
                    <span className="text-[#64748b] font-black text-[7px]">ORIGEN:</span>
                    <span className="text-[#0f172a] truncate">{origenVal || 'S/D'}</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center gap-1.5 text-center">
                    <span className="text-[#64748b] font-black text-[7px]">GARANTÍA:</span>
                    <span className="text-[#0f172a] truncate">{garantiaVal || '6 MESES'}</span>
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="h-[4px] bg-[#e30613] w-full shrink-0"></div>
              </div>
            )
          )}

          {/* PLANTILLA: FLEJE 2 (80x40mm) */}
          {templateName === 'fleje2' && (
            <div className={`${widthClass} ${heightClass} bg-white shadow-lg border border-dashed border-gray-400 rounded-md flex flex-col overflow-hidden text-left relative font-sans select-none`}>
              {/* Header */}
              <div className="bg-[#222222] text-white h-[42px] px-2.5 py-1 flex justify-between items-center shrink-0">
                <div className="max-w-[60%] flex flex-col justify-center text-left">
                  <span className="font-black text-[9px] uppercase leading-tight truncate">{tipo_herramienta}</span>
                  {destacado && <span className="text-[7.5px] font-bold text-[#ffed00] leading-none mt-0.5 truncate">{destacado}</span>}
                </div>
                <div className="max-w-[38%] text-right flex flex-col justify-center items-end">
                  {logoUrl && !logoFailed ? (
                    <img src={logoUrl} alt={marca} onError={() => setLogoFailed(true)} className="h-3.5 max-w-full object-contain" />
                  ) : (
                    <span className="font-black text-[8px] uppercase truncate text-white">{marca}</span>
                  )}
                  <span className="text-[6.5px] text-white font-extrabold tracking-wider leading-none mt-0.5">SAP {sku}</span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 flex border-b border-[#cbd5e1] min-h-0 bg-white">
                <div className="w-[50%] bg-[#f8fafc] border-r border-[#cbd5e1] p-1.5 flex flex-col justify-center overflow-hidden text-left">
                  <ul className="space-y-1 w-full">
                    {bodySpecs.slice(0, 3).map((spec, i) => (
                      <li key={i} className="text-[7.5px] font-medium text-[#0f172a] flex items-start leading-tight">
                        <span className="text-[#e30613] font-black mr-0.5 text-[8px] leading-none shrink-0">▪</span>
                        <span className="truncate"><strong>{spec.clave}:</strong> {spec.valor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="w-[50%] p-1 flex items-center justify-center bg-white">
                  <img src={currentFotoUrl || 'https://placehold.co/100?text=Sin+Foto'} alt="Foto" className="max-h-full max-w-full object-contain" />
                </div>
              </div>

              {/* Footer */}
              <div className="h-[24px] bg-[#f1f5f9] flex divide-x divide-[#cbd5e1] text-[7.5px] font-bold text-gray-800 shrink-0">
                <div className="flex-1 flex items-center justify-center gap-1 text-center">
                  <span className="text-[#64748b] font-black text-[6.5px]">ORIGEN:</span>
                  <span className="text-[#0f172a] truncate">{origenVal || 'S/D'}</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1 text-center">
                  <span className="text-[#64748b] font-black text-[6.5px]">GARANTÍA:</span>
                  <span className="text-[#0f172a] truncate">{garantiaVal || '6 MESES'}</span>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="h-[4px] bg-[#e30613] w-full shrink-0"></div>
            </div>
          )}

          {/* PLANTILLA: FICHA A4 */}
          {templateName === 'a4' && (
            <div className={`${widthClass} ${heightClass} bg-white shadow-lg border border-dashed border-gray-400 flex flex-col overflow-hidden text-left relative font-sans select-none text-[8px]`}>
              {/* Franja Superior Roja */}
              <div className="h-[12px] bg-[#e30613]"></div>
              
              {/* Header */}
              <div className="p-3 flex justify-between items-start border-b border-gray-200">
                <div>
                  <h3 className="text-sm font-black text-gray-800 uppercase leading-tight">{tipo_herramienta}</h3>
                  <span className="text-[10px] font-bold text-easy-red uppercase block mt-1">{marca}</span>
                </div>
                <div className="text-right">
                  {logoUrl ? (
                    <img src={logoUrl} alt={marca} className="h-6 object-contain" />
                  ) : (
                    <span className="font-bold uppercase text-[10px]">{marca}</span>
                  )}
                  <span className="text-[8px] text-gray-400 block mt-1">SAP {sku}</span>
                </div>
              </div>

              {/* Foto Principal */}
              <div className="h-[140px] flex items-center justify-center p-3 border-b border-gray-200 bg-white">
                <img src={currentFotoUrl || 'https://placehold.co/100?text=Sin+Foto'} alt="Foto" className="max-h-full max-w-full object-contain" />
              </div>

              {/* Especificaciones */}
              <div className="flex-1 p-3 space-y-2 overflow-y-auto bg-gray-50">
                <h4 className="text-[9px] font-bold text-gray-700 uppercase border-b border-gray-200 pb-0.5">Especificaciones Técnicas</h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {especificaciones.slice(0, 8).map((spec, i) => (
                    <div key={i} className="flex justify-between border-b border-gray-100 pb-0.5">
                      <span className="font-extrabold uppercase text-gray-400">{spec.clave}</span>
                      <span className="font-bold text-gray-800 text-right">{spec.valor}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer A4 */}
              <div className="p-3 bg-gray-100 border-t border-gray-200 flex justify-between items-center text-[7.5px] text-gray-500 font-bold">
                <div>ORIGEN: {origen}</div>
                <div>GARANTÍA: {garantia}</div>
                <div>CENCOSUD S.A.</div>
              </div>
            </div>
          )}

        </div>

        {/* Pie de modal */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-easy-dark text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
