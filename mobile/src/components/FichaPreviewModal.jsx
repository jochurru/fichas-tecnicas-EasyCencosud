import React from 'react';
import { X } from 'lucide-react';

export default function FichaPreviewModal({ sku, currentSpecs, currentFotoUrl, templateName = 'fleje3', onClose }) {
  const { marca = 'GENÉRICA', tipo_herramienta = 'HERRAMIENTA', especificaciones = [] } = currentSpecs || {};

  // Logo de marcas
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

  const brandLower = marca.toLowerCase();
  let logoUrl = null;
  for (const key of Object.keys(brandLogoMap)) {
    if (brandLower.includes(key)) {
      logoUrl = brandLogoMap[key];
      break;
    }
  }

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

  // Dimensiones en pantalla y clases específicas
  let widthClass = 'w-[340px]';
  let heightClass = 'h-[280px]';
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
              /* ROBUST MASTER TEMPLATE PREVIEW */
              <div className={`${widthClass} ${heightClass} bg-[#5d6368] text-white shadow-xl border-2 border-dashed border-white flex p-4 text-left relative font-sans select-none overflow-hidden justify-between`}>
                <div className="w-[46%] flex flex-col justify-between z-10 overflow-hidden">
                  <div>
                    {/* Logo ROBUST de alta precisión */}
                    <div className="mb-1.5 max-h-6 flex items-center">
                      {logoUrl ? (
                        <img src={logoUrl} alt={marca} className="h-5 object-contain mix-blend-screen" />
                      ) : (
                        <span className="font-black text-sm uppercase tracking-widest text-white font-mono">ROBUST</span>
                      )}
                    </div>

                    {/* Título en 2 líneas */}
                    <div className="mb-1.5 max-w-full overflow-hidden">
                      <div className="font-black text-xs uppercase leading-none tracking-tight truncate">
                        {['SET', 'KIT', 'COMBO'].includes((tipo_herramienta || '').split(' ')[0])
                          ? (tipo_herramienta || '').split(' ').slice(0, 2).join(' ')
                          : (tipo_herramienta || 'TALADRO').split(' ')[0]}
                      </div>
                      <div className="font-medium text-[10px] uppercase leading-tight line-clamp-2">
                        {['SET', 'KIT', 'COMBO'].includes((tipo_herramienta || '').split(' ')[0])
                          ? (tipo_herramienta || '').split(' ').slice(2).join(' ')
                          : (tipo_herramienta || '').split(' ').slice(1).join(' ') || 'PERCUTOR'}
                      </div>
                    </div>

                    {/* Highlight Pill (Solo si es eléctrica) */}
                    {esElectrico && (
                      <div className="inline-flex items-center border border-white/90 rounded px-1.5 py-0.5 text-[8px] font-bold mb-1.5">
                        <span className="text-white">{destacado.split(' ')[0] || '18V'}</span>
                        <span className="text-white mx-1 text-[7px]">⚡</span>
                        <span className="text-[#00c3e6] font-extrabold">{destacado.split(' ').slice(1).join(' ') || 'BRUSHLESS'}</span>
                      </div>
                    )}
                    {/* Specs List */}
                    <ul className="space-y-0.5 max-w-full">
                      {bodySpecs.slice(0, 4).map((spec, i) => (
                        <li key={i} className="text-[8.5px] font-semibold text-white flex items-start leading-tight">
                          <span className="mr-1 text-[9px]">·</span>
                          <span className="truncate">{spec.clave}: {spec.valor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* SKU Box Centrado entre Líneas */}
                  <div className="border-t border-b border-white py-1.5 w-28 text-left flex items-center justify-start mt-auto">
                    <span className="font-bold text-[11px] text-white leading-none tracking-wider">SKU: {sku}</span>
                  </div>

                  {/* Origen y Garantía Dinámicos para Robust */}
                  {(origenVal || garantiaVal) && (
                    <div className="text-[7.5px] font-bold text-gray-200 mt-1 flex flex-col gap-0.5 leading-none">
                      {origenVal && <div>ORIGEN: {origenVal}</div>}
                      {garantiaVal && <div>GARANTÍA: {garantiaVal}</div>}
                    </div>
                  )}
                </div>

                {/* Columna Derecha con Imagen Integrada Más Grande */}
                <div className="absolute right-0 top-0 bottom-0 w-[56%] flex flex-col justify-center items-center z-0 p-1">
                  <img src={currentFotoUrl || 'https://placehold.co/200?text=Sin+Foto'} alt="Foto" className="max-w-full max-h-full object-contain scale-115 transform-gpu" />
                </div>

                {/* Sello de Garantía dinámico (Se muestra solo si es eléctrica y NO se especificó garantía explícita en el formulario) */}
                {esElectrico && !garantiaVal && (
                  <img
                    src="/sello_garantia_5_anos.png"
                    alt="5 Años de Garantía"
                    className="absolute right-3 bottom-3 w-10 h-10 object-contain z-20"
                  />
                )}
              </div>
            ) : (
              /* ========================================================================= */
              /* PLANTILLA ESTÁNDAR (Fleje 2, Fleje 3, A4 Estándar)                       */
              /* ========================================================================= */
              <div className={`${widthClass} ${heightClass} bg-white text-gray-900 shadow-xl border border-gray-300 rounded-lg flex flex-col justify-between overflow-hidden relative font-sans select-none`}>
                {/* Header */}
                <div className="bg-[#222222] text-white h-[65px] px-3 py-2 flex justify-between items-center">
                  <div className="max-w-[60%] flex flex-col justify-center">
                    <span className="font-black text-xs uppercase leading-tight truncate">{tipo_herramienta}</span>
                    {destacado && <span className="text-[10px] font-bold text-[#ffed00] leading-none mt-0.5 truncate">{destacado}</span>}
                  </div>
                  <div className="max-w-[38%] text-right flex flex-col justify-center items-end">
                    {logoUrl ? (
                      <img src={logoUrl} alt={marca} className="h-5 object-contain" />
                    ) : (
                      <span className="font-bold text-[10px] uppercase truncate">{marca}</span>
                    )}
                    <span className="text-[8px] text-gray-400 leading-none mt-1">SAP {sku}</span>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 flex border-b border-gray-200 min-h-0">
                  <div className="w-[42%] bg-gray-50 border-r border-gray-200 flex flex-col divide-y divide-gray-100 overflow-hidden text-center justify-center">
                    {bodySpecs.slice(0, 4).map((spec, i) => (
                      <div key={i} className="flex-1 flex flex-col justify-center py-0.5 px-1 min-h-0">
                        <span className="text-[7px] font-extrabold uppercase text-gray-400 tracking-wide truncate">{spec.clave}</span>
                        <span className="text-[9px] font-bold text-gray-800 leading-tight truncate">{spec.valor}</span>
                      </div>
                    ))}
                    {bodySpecs.length < 4 && Array.from({ length: 4 - bodySpecs.length }).map((_, idx) => (
                      <div key={idx} className="flex-1 flex flex-col justify-center min-h-0">
                        <span className="text-[7px] font-extrabold uppercase text-gray-400 tracking-wide">-</span>
                      </div>
                    ))}
                  </div>
                  <div className="w-[58%] p-2 flex items-center justify-center">
                    <img src={currentFotoUrl || 'https://placehold.co/100?text=Sin+Foto'} alt="Foto" className="max-h-full max-w-full object-contain" />
                  </div>
                </div>

                {/* Footer Grid */}
                <div className="h-[48px] bg-gray-100 flex divide-x divide-gray-200">
                  <div className="flex-1 flex flex-col justify-center items-center text-center p-1 min-h-0">
                    <span className="text-[7px] font-extrabold uppercase text-gray-400 tracking-wide truncate">{bodySpecs[4]?.clave || '-'}</span>
                    <span className="text-[9px] font-bold text-gray-800 leading-none truncate">{bodySpecs[4]?.valor || '-'}</span>
                  </div>
                  <div className="flex-1 flex flex-col justify-center items-center text-center p-1 min-h-0">
                    <span className="text-[7px] font-extrabold uppercase text-gray-400 tracking-wide truncate">Origen</span>
                    <span className="text-[9px] font-bold text-gray-800 leading-none truncate">{origenVal || '-'}</span>
                  </div>
                  <div className="flex-1 flex flex-col justify-center items-center text-center p-1 min-h-0">
                    <span className="text-[7px] font-extrabold uppercase text-gray-400 tracking-wide truncate">Garantía</span>
                    <span className="text-[9px] font-bold text-gray-800 leading-none truncate">{garantiaVal || '-'}</span>
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="h-[8px] bg-[#e30613]"></div>
              </div>
            )
          )}

          {/* PLANTILLA: FLEJE 2 (80x40mm) */}
          {templateName === 'fleje2' && (
            <div className={`${widthClass} ${heightClass} bg-white shadow-lg border border-dashed border-gray-400 flex flex-col overflow-hidden text-left relative font-sans select-none`}>
              {/* Header */}
              <div className="bg-[#222222] text-white h-[44px] px-2.5 py-1 flex justify-between items-center">
                <div className="max-w-[60%] flex flex-col justify-center">
                  <span className="font-black text-[9px] uppercase leading-tight truncate">{tipo_herramienta}</span>
                  {destacado && <span className="text-[8px] font-bold text-[#ffed00] leading-none mt-0.5 truncate">{destacado}</span>}
                </div>
                <div className="max-w-[38%] text-right flex flex-col justify-center items-end">
                  {logoUrl ? (
                    <img src={logoUrl} alt={marca} className="h-4 object-contain" />
                  ) : (
                    <span className="font-bold text-[8px] uppercase truncate">{marca}</span>
                  )}
                  <span className="text-[6.5px] text-gray-400 leading-none mt-0.5">SAP {sku}</span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 flex border-b border-gray-200 min-h-0">
                <div className="w-[50%] bg-gray-50 border-r border-gray-200 flex flex-col divide-y divide-gray-100 overflow-hidden justify-center px-1">
                  {especificaciones.slice(0, 3).map((spec, i) => (
                    <div key={i} className="flex justify-between items-center py-0.5 text-[8px] min-h-0">
                      <span className="font-extrabold uppercase text-gray-400 truncate max-w-[45%]">{spec.clave}</span>
                      <span className="font-bold text-gray-800 truncate max-w-[50%]">{spec.valor}</span>
                    </div>
                  ))}
                  {especificaciones.length < 3 && Array.from({ length: 3 - especificaciones.length }).map((_, idx) => (
                    <div key={idx} className="flex justify-between items-center py-0.5 text-[8px] min-h-0">
                      <span className="font-extrabold uppercase text-gray-400">-</span>
                      <span className="font-bold text-gray-800">-</span>
                    </div>
                  ))}
                </div>
                <div className="w-[50%] p-1 flex items-center justify-center">
                  <img src={currentFotoUrl || 'https://placehold.co/100?text=Sin+Foto'} alt="Foto" className="max-h-full max-w-full object-contain" />
                </div>
              </div>

              {/* Footer */}
              <div className="h-[24px] bg-gray-100 flex items-center px-2 justify-between text-[7.5px] font-bold text-gray-800">
                <div className="flex gap-1">
                  <span className="text-gray-400 font-extrabold">ORIGEN:</span>
                  <span>{origen}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-gray-400 font-extrabold">GARANTÍA:</span>
                  <span>{garantia}</span>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="h-[5px] bg-[#e30613]"></div>
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
