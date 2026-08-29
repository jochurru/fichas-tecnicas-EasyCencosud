/**
 * Utilitario de Reglas de Negocio para Calidad de Datos (Fichas Técnicas Easy Cencosud)
 */

/**
 * Calcula el porcentaje de completitud de una ficha técnica (0 a 100%).
 * 
 * Ponderación:
 * - SKU presente: 15%
 * - EAN presente: 15%
 * - Marca presente: 15%
 * - Foto/Imagen presente: 20%
 * - Descripción presente: 15%
 * - Especificaciones técnicas mínimas (al menos 3 atributos): 20%
 * 
 * @param {Object} producto - Producto maestro SAP
 * @param {Object} ficha - Ficha técnica consolidada o borrador
 * @returns {number} Porcentaje de completitud (entero de 0 a 100)
 */
export function calculateCompleteness(producto, ficha, brandSlugsWithLogos = []) {
  let score = 0;
  
  if (producto?.sku) score += 15;
  if (ficha?.ean || producto?.ean) score += 15;
  
  const specsObj = ficha?.especificaciones_json || {};
  const specsList = specsObj.especificaciones || [];
  const marca = specsObj.marca || '';
  
  if (marca && marca.trim().length > 0) {
    const brandLower = marca.trim().toLowerCase();
    const brandLogoMap = {
      'einhell': true, 'bosch': true, 'dewalt': true, 'stanley': true,
      'bahco': true, 'robust': true, 'black & decker': true, 'black and decker': true, 
      'black+decker': true, 'b&d': true, 'makita': true, 'karcher': true, 
      'dremel': true, 'skil': true, 'gamma': true, 'kushiro': true, 
      'dowen pagio': true, 'lusqtoff': true, 'total': true, 'truper': true, 
      'philco': true, 'stihl': true, 'schneider': true, 'force': true, 
      'urrea': true, 'irwin': true, 'crossmaster': true, 'biassoni': true, 
      'tramontina': true, 'cta': true
    };
    const hasLogo = Object.keys(brandLogoMap).some(key => brandLower.includes(key)) || 
                    brandSlugsWithLogos.includes(brandLower.replace(/[^a-z0-9-_]/g, ''));
    
    score += 10;
    if (hasLogo) score += 5;
  }
  
  if (ficha?.foto_url && ficha.foto_url.trim().length > 0) score += 20;
  if (producto?.descripcion && producto.descripcion.trim().length > 0) score += 15;
  
  // Al menos 3 especificaciones
  if (specsList.length >= 3) {
    score += 20;
  } else if (specsList.length > 0) {
    score += Math.round(specsList.length * 6.6); // Crédito parcial
  }
  
  return Math.min(score, 100);
}

/**
 * Analiza la ficha y el maestro SAP para detectar inconsistencias de datos.
 * 
 * @param {Object} producto - Producto maestro SAP
 * @param {Object} ficha - Ficha técnica
 * @param {Array<string>} [eanList] - Opcional. Lista de EANs ya mapeados para chequear duplicados.
 * @returns {Array<Object>} Inconsistencias detectadas [{ tipo, mensaje, gravedad }]
 */
export function detectInconsistencies(producto, ficha, eanList = [], brandSlugsWithLogos = []) {
  const alerts = [];
  const specsObj = ficha?.especificaciones_json || {};
  const specsList = specsObj.especificaciones || [];
  const ean = ficha?.ean || producto?.ean || '';
  const fotoUrl = ficha?.foto_url || '';
  const desc = producto?.descripcion || '';
  const marca = specsObj.marca || '';

  // 0. Marca Faltante o Logo de Marca Faltante
  if (!marca || marca.trim().length === 0) {
    alerts.push({
      tipo: 'BRAND_MISSING',
      mensaje: 'Falta ingresar la marca del producto.',
      gravedad: 'media'
    });
  } else {
    const brandLower = marca.trim().toLowerCase();
    const brandLogoMap = {
      'einhell': true, 'bosch': true, 'dewalt': true, 'stanley': true,
      'bahco': true, 'robust': true, 'black & decker': true, 'black and decker': true, 
      'black+decker': true, 'b&d': true, 'makita': true, 'karcher': true, 
      'dremel': true, 'skil': true, 'gamma': true, 'kushiro': true, 
      'dowen pagio': true, 'lusqtoff': true, 'total': true, 'truper': true, 
      'philco': true, 'stihl': true, 'schneider': true, 'force': true, 
      'urrea': true, 'irwin': true, 'crossmaster': true, 'biassoni': true, 
      'tramontina': true, 'cta': true
    };
    const hasLogo = Object.keys(brandLogoMap).some(key => brandLower.includes(key)) || 
                    brandSlugsWithLogos.includes(brandLower.replace(/[^a-z0-9-_]/g, ''));
    if (!hasLogo) {
      alerts.push({
        tipo: 'BRAND_LOGO_MISSING',
        mensaje: 'Falta registrar el logotipo oficial para la marca.',
        gravedad: 'baja'
      });
    }
  }

  // 1. EAN Faltante o Duplicado
  if (!ean) {
    alerts.push({
      tipo: 'EAN_MISSING',
      mensaje: 'Falta asociar código de barras EAN.',
      gravedad: 'media'
    });
  } else if (eanList.length > 0 && eanList.includes(ean)) {
    alerts.push({
      tipo: 'EAN_DUPLICATE',
      mensaje: `El código EAN ${ean} está duplicado en otra ficha técnica.`,
      gravedad: 'alta'
    });
  }

  // 2. Imagen/Foto Faltante
  if (!fotoUrl || fotoUrl.trim().length === 0) {
    alerts.push({
      tipo: 'IMAGE_MISSING',
      mensaje: 'El producto no posee imagen oficial.',
      gravedad: 'media'
    });
  }

  // 3. Especificaciones Vacías o Anómalas
  if (specsList.length === 0) {
    alerts.push({
      tipo: 'SPECS_EMPTY',
      mensaje: 'No se han ingresado especificaciones técnicas.',
      gravedad: 'alta'
    });
  } else {
    specsList.forEach((spec, idx) => {
      const key = (spec.clave || '').trim();
      const val = (spec.valor || '').trim().toLowerCase();
      
      if (!key || !val) {
        alerts.push({
          tipo: 'SPEC_VALUE_EMPTY',
          mensaje: `La especificación #${idx + 1} tiene campos vacíos.`,
          gravedad: 'alta'
        });
      } else if (
        val === 'n/a' || 
        val === 'null' || 
        val === 'undefined' || 
        val === 'no aplica' || 
        val === '-' ||
        val === 'sin especificar'
      ) {
        alerts.push({
          tipo: 'SPEC_VALUE_ANOMALOUS',
          mensaje: `El atributo "${spec.clave}" contiene un valor anómalo ("${spec.valor}").`,
          gravedad: 'media'
        });
      }
    });
  }

  // 4. Discrepancia entre descripción de SAP y marca ingresada
  if (marca && desc) {
    const descLower = desc.toLowerCase();
    const marcaLower = marca.toLowerCase();
    
    // Si la descripción de SAP incluye marcas reconocidas pero la ficha tiene otra marca
    const commonBrands = ['dewalt', 'bosch', 'einhell', 'stanley', 'black', 'makita', 'karcher', 'skil', 'gamma'];
    const detectedSapBrand = commonBrands.find(b => descLower.includes(b));
    
    if (detectedSapBrand && !marcaLower.includes(detectedSapBrand)) {
      alerts.push({
        tipo: 'BRAND_DISCREPANCY',
        mensaje: `Posible discrepancia: La descripción SAP sugiere marca "${detectedSapBrand.toUpperCase()}" pero se configuró "${marca}".`,
        gravedad: 'alta'
      });
    }
  }

  return alerts;
}

/**
 * Devuelve un color/badge CSS para el estado de la ficha técnica.
 * 
 * @param {string} estado - Estado de la ficha
 * @returns {Object} { label, colorBg, colorText }
 */
export function getEstadoMetadata(estado) {
  const map = {
    'SIN_FICHA': { label: 'Sin Ficha', bg: 'bg-slate-100 border border-slate-200', text: 'text-slate-600' },
    'BORRADOR': { label: 'Borrador', bg: 'bg-amber-100 border border-amber-300', text: 'text-amber-800' },
    'GENERADA_POR_IA': { label: '🤖 Borrador IA', bg: 'bg-purple-100 border border-purple-200', text: 'text-purple-800' },
    'generada_ia': { label: '🤖 Borrador IA', bg: 'bg-purple-100 border border-purple-200', text: 'text-purple-800' },
    'PENDIENTE_VALIDACION': { label: '⌛ Pendiente de Revisión', bg: 'bg-blue-100 border border-blue-300', text: 'text-blue-800' },
    'pendiente_revision': { label: '⌛ Pendiente de Revisión', bg: 'bg-blue-100 border border-blue-300', text: 'text-blue-800' },
    'APROBADA': { label: '✓ Aprobada — Lista para Imprimir', bg: 'bg-emerald-100 border border-emerald-300', text: 'text-emerald-800' },
    'aprobado': { label: '✓ Aprobada — Lista para Imprimir', bg: 'bg-emerald-100 border border-emerald-300', text: 'text-emerald-800' },
    'OBSERVADA': { label: 'Observada / Devuelta', bg: 'bg-rose-100 border border-rose-300', text: 'text-rose-800' },
    'rechazado': { label: 'Observada / Devuelta', bg: 'bg-rose-100 border border-rose-300', text: 'text-rose-800' },
    'DESACTUALIZADA': { label: 'Desactualizada', bg: 'bg-yellow-100 border border-yellow-300', text: 'text-yellow-800' },
    'VENCIDA': { label: 'Vencida', bg: 'bg-red-100 border border-red-300', text: 'text-red-800' }
  };
  
  return map[estado] || { label: estado || 'Desconocido', bg: 'bg-slate-100 border border-slate-200', text: 'text-slate-600' };
}