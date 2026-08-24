import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Escapa entidades HTML para evitar inyecciones XSS.
 * @param {string} str - Cadena de texto
 * @returns {string} Texto sanitizado
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @fileoverview Formateador de especificaciones técnicas y atributos destacados para PDFs.
 * Evalúa si una herramienta es eléctrica/batería, formatea la lista HTML de viñetas,
 * genera el bloque destacado (18V BRUSHLESS) e inyecta la imagen oficial del sello de garantía.
 */

/**
 * Determina si un producto es eléctrico o accionado por motor/batería.
 * 
 * @param {Array<{clave: string, valor: string}>} specs - Lista de especificaciones del producto
 * @returns {boolean} True si el producto posee especificaciones eléctricas
 */
export function isElectricTool(specs = []) {
  return specs.some(s => {
    const claveLower = (s.clave || '').toLowerCase();
    const valorLower = (s.valor || '').toLowerCase();
    return claveLower.includes('voltaje') || claveLower.includes('potencia') || 
           claveLower.includes('watts') || claveLower.includes('motor') ||
           claveLower.includes('batería') || claveLower.includes('bateria') ||
           claveLower.includes('amperaje') || claveLower.includes('amp') ||
           valorLower.includes('brushless') || valorLower.includes('brushed') ||
           valorLower.match(/\d+\s*v\b/) || valorLower.match(/\d+\s*w\b/);
  });
}

/**
 * Formatea el bloque destacado (Pill 18V BRUSHLESS) según el estado eléctrico del producto.
 * 
 * @param {Array<{clave: string, valor: string}>} specs - Lista de especificaciones
 * @param {string} rawDestacado - Texto destacado crudo o spec de potencia
 * @returns {{ destacadoVal: string, destacadoLbl: string, mostrarPill: boolean }} Objeto de estado del pill
 */
export function getHighlightPill(specs = [], rawDestacado = '') {
  const esElectrico = isElectricTool(specs);
  let destacadoVal = '';
  let destacadoLbl = '';
  let mostrarPill = false;

  if (esElectrico && rawDestacado) {
    mostrarPill = true;
    const parts = rawDestacado.split(' ');
    if (parts.length > 1) {
      destacadoVal = parts[0];
      destacadoLbl = parts.slice(1).join(' ');
    } else {
      destacadoVal = rawDestacado;
      destacadoLbl = '';
    }
  } else if (esElectrico) {
    const voltSpec = specs.find(s => (s.clave || '').toLowerCase().includes('voltaje'));
    if (voltSpec) {
      mostrarPill = true;
      destacadoVal = (voltSpec.valor || '').toUpperCase();
      const brushSpec = specs.find(s => (s.valor || '').toLowerCase().includes('brushless'));
      destacadoLbl = brushSpec ? 'BRUSHLESS' : '';
    }
  }

  return { destacadoVal, destacadoLbl, mostrarPill };
}

/**
 * Genera el marcado HTML para la lista de viñetas de especificaciones principales.
 * 
 * @param {Array<{clave: string, valor: string}>} specs - Lista de especificaciones del producto
 * @returns {string} Código HTML `<li>...</li>`
 */
export function formatSpecsListHtml(specs = []) {
  return specs.slice(0, 4).map(s => 
    `<li class="spec-item"><span class="spec-bullet">·</span><span class="spec-text">${escapeHtml(s.clave)}: ${escapeHtml(s.valor)}</span></li>`
  ).join('');
}

/**
 * Obtiene la representación Data URI (Base64) de la imagen oficial del sello de garantía.
 * 
 * @returns {string} Data URI `data:image/png;base64,...` o cadena vacía si no existe
 */
export function getWarrantySealBase64() {
  try {
    const selloPath = path.join(__dirname, '../../assets/sello_garantia_5_anos.png');
    if (fs.existsSync(selloPath)) {
      return `data:image/png;base64,${fs.readFileSync(selloPath).toString('base64')}`;
    }
  } catch (err) {
    console.warn('[SpecFormatter] Error al cargar sello_garantia_5_anos.png:', err.message);
  }
  return '';
}
