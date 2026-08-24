import { getBrowser, cleanupBrowser } from './pdf/browserManager.js';
import { loadTemplate } from './pdf/templateLoader.js';
import { processBrandLogo } from './pdf/brandLogoProcessor.js';
import { isElectricTool, getHighlightPill, formatSpecsListHtml, getWarrantySealBase64 } from './pdf/specFormatter.js';

/**
 * Escapa entidades HTML para prevenir vulnerabilidades XSS.
 * @param {string} str - Texto a escapar
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
 * @fileoverview Fachada principal para la generación de PDFs.
 * Coordina los módulos de Puppeteer, carga de plantillas, formateo de especificaciones
 * e inyección de logos para generar archivos PDF en alta definición.
 */

/**
 * Genera un Buffer PDF a partir de una ficha técnica y su plantilla correspondiente.
 * 
 * @async
 * @param {Object} ficha - Datos completos de la ficha técnica y producto
 * @param {string} [templateName='fleje3'] - Formato objetivo ('fleje3', 'fleje2', 'a4')
 * @returns {Promise<Buffer>} Buffer binario del archivo PDF generado
 * @throws {Error} Si faltan datos obligatorios o falla la renderización en Puppeteer
 */
export async function generatePdf(ficha, templateName = 'fleje3') {
  const producto = ficha.producto || {};
  const ficha_tecnica = ficha.ficha_tecnica || {};
  const specData = ficha_tecnica.especificaciones_json || ficha_tecnica.datos_especificos || {};
  
  // Extraer la lista de especificaciones de donde esté disponible (soporta todas las capas de datos)
  let rawSpecs = [];
  if (Array.isArray(ficha.especificaciones) && ficha.especificaciones.length > 0) {
    rawSpecs = ficha.especificaciones;
  } else if (Array.isArray(ficha_tecnica.especificaciones) && ficha_tecnica.especificaciones.length > 0) {
    rawSpecs = ficha_tecnica.especificaciones;
  } else if (Array.isArray(specData.especificaciones) && specData.especificaciones.length > 0) {
    rawSpecs = specData.especificaciones;
  }

  const specs = rawSpecs.map(e => ({
    clave: e.clave || e.label || e.nombre || '',
    valor: e.valor || e.value || ''
  }));

  const brandName = producto.marca || specData.marca || ficha_tecnica.marca || '';

  // Cargar contenido de la plantilla HTML
  let html = loadTemplate(templateName, brandName);

  // Procesar logotipo de marca (DB / Fallbacks / SVG)
  const { headerBrandHtml } = await processBrandLogo(brandName, templateName);

  // Evaluar especificaciones y atributos eléctricos
  const esElectrico = isElectricTool(specs);
  const potenciaSpec = specs.find(s => 
    (s.clave || '').toLowerCase().includes('potencia') || 
    (s.clave || '').toLowerCase().includes('voltaje') ||
    (s.clave || '').toLowerCase().includes('capacidad')
  );
  const destacado = potenciaSpec ? potenciaSpec.valor : '';
  const { destacadoVal, destacadoLbl, mostrarPill } = getHighlightPill(specs, destacado);

  // Extraer Origen y Garantía
  const origenSpec = specs.find(s => (s.clave || '').toLowerCase().includes('origen') || (s.clave || '').toLowerCase().includes('país'));
  const origen = origenSpec ? origenSpec.valor.toUpperCase() : 'CHINA';

  const garantiaSpec = specs.find(s => (s.clave || '').toLowerCase().includes('garant'));
  const garantia = garantiaSpec ? garantiaSpec.valor.toUpperCase() : '5 AÑOS';
  const garantiaMatch = garantia.match(/(\d+)/);
  const garantiaNumero = garantiaMatch ? garantiaMatch[1] : '5';

  const ean = producto.ean || (producto.eans && producto.eans.length > 0 ? producto.eans[0].codigo_ean : 'SIN EAN');
  const aprobado_por = ficha_tecnica.aprobado_por || 'OPERADOR_LOCAL';

  // División del título en dos líneas (SET / KIT / COMBO / JUEGO)
  const tipoHerramientaStr = specData.tipo_herramienta || ficha_tecnica.tipo_herramienta || producto.descripcion || '';
  const descWords = tipoHerramientaStr.trim().split(' ');
  let tituloLinea1 = descWords[0] || 'HERRAMIENTA';
  let tituloLinea2 = descWords.slice(1).join(' ') || '';

  if (descWords.length >= 2 && ['SET', 'KIT', 'COMBO', 'JUEGO'].includes(descWords[0].toUpperCase())) {
    tituloLinea1 = descWords[0] + ' ' + descWords[1];
    tituloLinea2 = descWords.slice(2).join(' ');
  }

  // Formatear lista de viñetas HTML
  const specsListHtml = formatSpecsListHtml(specs);
  const selloGarantiaImg = getWarrantySealBase64();

  // Inyección de variables en el HTML
  html = html.replace(/\{\{tipo_herramienta\}\}/g, escapeHtml(specData.tipo_herramienta || 'HERRAMIENTA'));
  html = html.replace(/\{\{destacado\}\}/g, escapeHtml(destacado));
  html = html.replace(/\{\{titulo_linea1\}\}/g, escapeHtml(tituloLinea1));
  html = html.replace(/\{\{titulo_linea2\}\}/g, escapeHtml(tituloLinea2));
  html = html.replace(/\{\{destacado_val\}\}/g, escapeHtml(destacadoVal));
  html = html.replace(/\{\{destacado_lbl\}\}/g, escapeHtml(destacadoLbl));
  html = html.replace(/\{\{pill_display\}\}/g, mostrarPill ? 'inline-flex' : 'none');
  html = html.replace(/\{\{warranty_seal_display\}\}/g, esElectrico ? 'flex' : 'none');
  html = html.replace(/\{\{specs_html\}\}/g, specsListHtml);
  html = html.replace(/\{\{garantia_sello_img\}\}/g, selloGarantiaImg);
  html = html.replace(/\{\{marca\}\}/g, headerBrandHtml);
  html = html.replace(/\{\{sku\}\}/g, escapeHtml(producto.sku));
  html = html.replace(/\{\{ean\}\}/g, escapeHtml(ean));
  html = html.replace(/\{\{descripcion\}\}/g, escapeHtml(producto.descripcion || ''));
  html = html.replace(/\{\{proveedor\}\}/g, escapeHtml(producto.proveedor || 'DESCONOCIDO'));
  html = html.replace(/\{\{foto_url\}\}/g, ficha_tecnica.foto_url || 'https://placehold.co/400x300?text=Sin+Foto');
  html = html.replace(/\{\{origen\}\}/g, escapeHtml(origen));
  html = html.replace(/\{\{garantia\}\}/g, escapeHtml(garantia));
  html = html.replace(/\{\{garantia_numero\}\}/g, escapeHtml(garantiaNumero));
  html = html.replace(/\{\{aprobado_por\}\}/g, escapeHtml(aprobado_por));

  // Mapear especificaciones individuales spec1 a spec5
  for (let i = 0; i < 5; i++) {
    const spec = specs[i];
    if (spec) {
      html = html.replace(new RegExp(`\\{\\{spec${i+1}_label\\}\\}`, 'g'), escapeHtml(spec.clave || '-'));
      html = html.replace(new RegExp(`\\{\\{spec${i+1}_value\\}\\}`, 'g'), escapeHtml(spec.valor || '-'));
    } else {
      html = html.replace(new RegExp(`\\{\\{spec${i+1}_label\\}\\}`, 'g'), '-');
      html = html.replace(new RegExp(`\\{\\{spec${i+1}_value\\}\\}`, 'g'), '-');
    }
  }

  // Renderizar PDF en lienzo A4 exacto (210mm x 297mm) con márgenes nulos para evitar recortes físicos en impresoras
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      width: '210mm',
      height: '297mm',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      }
    });
    return pdfBuffer;
  } finally {
    await page.close();
  }
}

/**
 * Genera un archivo ZIP compuesto conteniendo múltiples fichas técnicas en formato PDF.
 * 
 * @async
 * @param {Array<Object>} fichas - Arreglo de fichas técnicas
 * @param {string} [templateName='fleje3'] - Plantilla objetivo
 * @returns {Promise<Buffer>} Buffer binario del archivo ZIP comprimido
 */
export async function generatePdfBatch(fichas, templateName = 'fleje3') {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const ficha of fichas) {
    try {
      const pdfBuffer = await generatePdf(ficha, templateName);
      const filename = `ficha_${ficha.producto.sku}_${templateName}.pdf`;
      zip.file(filename, pdfBuffer);
    } catch (err) {
      console.error(`[pdfGenerator] Error al incluir ficha SKU ${ficha.producto?.sku} en lote:`, err.message);
    }
  }

  return await zip.generateAsync({ type: 'nodebuffer' });
}

// Aliases de exportación para compatibilidad con las rutas de impresion.js
export { 
  generatePdf as generatePdfFromFicha, 
  generatePdfBatch as generateBatchPdf,
  cleanupBrowser 
};
