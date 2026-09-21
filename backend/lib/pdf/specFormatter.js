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
 * Determina el límite máximo seguro de especificaciones según el formato y el volumen de contenido.
 * Fuente única de verdad para evitar inconsistencias entre vistas previas, PDFs unitarios y lotes.
 * 
 * @param {string} templateName - Nombre o identificador de plantilla ('a4', 'fleje3', 'fleje2')
 * @param {Array<{clave: string, valor: string}>} [availableSpecs=[]] - Especificaciones disponibles
 * @returns {number} Cantidad máxima de especificaciones permitidas sin riesgo de overflow
 */
export function getMaxSpecs(templateName = 'fleje3', availableSpecs = []) {
  const tmpl = (templateName || '').toLowerCase();
  if (tmpl.includes('a4')) {
    // En A4 (cuerpo de ~193mm) se admiten hasta 11 especificaciones.
    // Si más de 3 especificaciones superan los 50 caracteres (multilínea), se ajusta a 9-10 para asegurar cero overflow.
    const longSpecs = availableSpecs.filter(s => ((s.clave || '').length + (s.valor || '').length) > 50).length;
    if (longSpecs >= 4) return 9;
    if (longSpecs >= 2) return 10;
    return 11;
  }
  if (tmpl.includes('fleje2') || tmpl.includes('fleje_2')) {
    return 5;
  }
  // Fleje 3 (100 x 70 mm con cuerpo de 39.5 mm):
  return 7;
}

/**
 * Determina la clase CSS de densidad para adaptar gap y font-size según cantidad de especificaciones.
 * 
 * @param {number} count - Cantidad de especificaciones a renderizar
 * @param {string} templateName - Formato objetivo
 * @returns {string} Clase CSS de densidad ('density-low', 'density-normal', 'density-high')
 */
export function getDensityClass(count = 0, templateName = 'fleje3') {
  const tmpl = (templateName || '').toLowerCase();
  if (tmpl.includes('a4')) {
    if (count <= 5) return 'density-low';
    if (count >= 9) return 'density-high';
    return 'density-normal';
  }
  if (count <= 3) return 'density-low';
  if (count >= 7) return 'density-high';
  return 'density-normal';
}

/**
 * Calcula una clase adaptativa de tamaño de título según longitud y peso visual del texto.
 * Combina heurística de caracteres, conteo de palabras y protección de contenedor.
 * 
 * @param {string} title - Texto del título o tipo de herramienta
 * @returns {string} Clase CSS ('title-size-short', 'title-size-medium', 'title-size-long')
 */
export function getTitleAdaptiveClass(title = '') {
  const clean = (title || '').trim();
  const len = clean.length;
  const words = clean.split(/\s+/).filter(Boolean).length;
  if (len <= 16 && words <= 2) return 'title-size-short';
  if (len <= 34 && words <= 4) return 'title-size-medium';
  return 'title-size-long';
}

/**
 * Genera el marcado HTML para la lista de viñetas de especificaciones principales.
 * Soporta tanto el pase directo de templateName como un número maxSpecs para compatibilidad.
 * 
 * @param {Array<{clave: string, valor: string}>} specs - Lista de especificaciones del producto
 * @param {string|number} [templateOrMax=7] - Nombre de plantilla o número máximo directo
 * @returns {string} Código HTML `<li>...</li>`
 */
export function formatSpecsListHtml(specs = [], templateOrMax = 'fleje3') {
  const maxSpecs = typeof templateOrMax === 'number' 
    ? templateOrMax 
    : getMaxSpecs(templateOrMax, specs);

  return specs.slice(0, maxSpecs).map(s => 
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
