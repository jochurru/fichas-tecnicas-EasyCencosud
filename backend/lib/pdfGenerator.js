import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBrowser, acquirePageSlot, releasePageSlot, cleanupBrowser } from './pdf/browserManager.js';
import { loadTemplate } from './pdf/templateLoader.js';
import { processBrandLogo } from './pdf/brandLogoProcessor.js';
import { isElectricTool, getHighlightPill, formatSpecsListHtml, getWarrantySealBase64 } from './pdf/specFormatter.js';
import { dataService } from '../services/dataService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Escapa entidades HTML para evitar inyecciones XSS en Puppeteer.
 * @param {string} str - Texto a sanitizar
 * @returns {string} Texto escapado
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

  // Extraer Origen y Garantía solo si existen explícitamente en especificaciones
  const origenSpec = specs.find(s => (s.clave || '').toLowerCase().includes('origen') || (s.clave || '').toLowerCase().includes('país'));
  const origenVal = (origenSpec && origenSpec.valor && origenSpec.valor.trim() !== '-') ? origenSpec.valor.trim().toUpperCase() : null;

  const garantiaSpec = specs.find(s => (s.clave || '').toLowerCase().includes('garant'));
  const garantiaVal = (garantiaSpec && garantiaSpec.valor && garantiaSpec.valor.trim() !== '-') ? garantiaSpec.valor.trim().toUpperCase() : null;
  const garantiaMatch = garantiaVal ? garantiaVal.match(/(\d+)/) : null;
  const garantiaNumero = garantiaMatch ? garantiaMatch[1] : null;

  let metaItemsHtml = '';
  if (origenVal) metaItemsHtml += `<span class="meta-text">ORIGEN: ${escapeHtml(origenVal)}</span>`;
  if (garantiaVal) metaItemsHtml += `<span class="meta-text">GARANTÍA: ${escapeHtml(garantiaVal)}</span>`;
  const metaInfoHtml = metaItemsHtml ? `<div class="meta-info">${metaItemsHtml}</div>` : '';

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

  // Filtrar especificaciones del cuerpo (excluyendo Garantía y Origen)
  const bodySpecs = specs.filter(s => {
    const k = (s.clave || '').toLowerCase();
    return !k.includes('garant') && !k.includes('origen') && !k.includes('país');
  });

  // Formatear lista de viñetas HTML (hasta 7 especificaciones)
  const specsListHtml = formatSpecsListHtml(bodySpecs, 7);
  const selloGarantiaImg = getWarrantySealBase64();

  // Inyección de variables en el HTML
  html = html.replace(/\{\{tipo_herramienta\}\}/g, escapeHtml(specData.tipo_herramienta || 'HERRAMIENTA'));
  html = html.replace(/\{\{destacado\}\}/g, escapeHtml(destacado));
  html = html.replace(/\{\{titulo_linea1\}\}/g, escapeHtml(tituloLinea1));
  html = html.replace(/\{\{titulo_linea2\}\}/g, escapeHtml(tituloLinea2));
  html = html.replace(/\{\{destacado_val\}\}/g, escapeHtml(destacadoVal));
  html = html.replace(/\{\{destacado_lbl\}\}/g, escapeHtml(destacadoLbl));
  const mostrarSelloGarantia = esElectrico && !garantiaVal;
  html = html.replace(/\{\{pill_display\}\}/g, mostrarPill ? 'inline-flex' : 'none');
  html = html.replace(/\{\{warranty_seal_display\}\}/g, mostrarSelloGarantia ? 'flex' : 'none');
  html = html.replace(/\{\{specs_html\}\}/g, specsListHtml);
  html = html.replace(/\{\{garantia_sello_img\}\}/g, selloGarantiaImg);
  html = html.replace(/\{\{marca\}\}/g, headerBrandHtml);
  html = html.replace(/\{\{sku\}\}/g, escapeHtml(producto.sku));
  html = html.replace(/\{\{ean\}\}/g, escapeHtml(ean));
  html = html.replace(/\{\{descripcion\}\}/g, escapeHtml(producto.descripcion || ''));
  html = html.replace(/\{\{proveedor\}\}/g, escapeHtml(producto.proveedor || 'DESCONOCIDO'));
  html = html.replace(/\{\{foto_url\}\}/g, ficha_tecnica.foto_url || 'https://placehold.co/400x300?text=Sin+Foto');
  html = html.replace(/\{\{origen\}\}/g, escapeHtml(origenVal || 'S/D'));
  html = html.replace(/\{\{garantia\}\}/g, escapeHtml(garantiaVal || '6 Meses'));
  html = html.replace(/\{\{meta_info_html\}\}/g, metaInfoHtml);
  html = html.replace(/\{\{garantia_numero\}\}/g, escapeHtml(garantiaNumero || ''));
  html = html.replace(/\{\{aprobado_por\}\}/g, escapeHtml(aprobado_por));

  // Adquirir un slot del semáforo de concurrencia antes de abrir la pestaña
  await acquirePageSlot();

  // Renderizar PDF en lienzo A4 exacto (210mm x 297mm) con márgenes nulos para evitar recortes físicos en impresoras
  const browser = await getBrowser();
  let page = null;

  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Esperar a que todas las imágenes (fotos remotas y logos) se hayan descargado por completo
    const imageLoadResults = await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll('img'));
      const failed = [];
      await Promise.all(images.map(img => {
        if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
        return new Promise(resolve => {
          let done = false;
          let timer = null;
          img.addEventListener('load', () => {
            if (!done) {
              done = true;
              if (timer) clearTimeout(timer);
              resolve();
            }
          }, { once: true });
          img.addEventListener('error', () => {
            if (!done) {
              done = true;
              if (timer) clearTimeout(timer);
              failed.push({ src: img.src, reason: 'NETWORK_ERROR' });
              resolve();
            }
          }, { once: true });
          timer = setTimeout(() => {
            if (!done) {
              done = true;
              failed.push({ src: img.src, reason: 'TIMEOUT_3S' });
              resolve();
            }
          }, 3000);
        });
      }));
      return failed;
    }).catch(err => {
      console.warn('[Puppeteer] Advertencia en evaluación de imágenes:', err.message);
      return [];
    });

    if (imageLoadResults && imageLoadResults.length > 0) {
      console.warn(`[Puppeteer] ⚠️ Fallo al cargar ${imageLoadResults.length} imagen(es) para SKU ${producto.sku} (${templateName}):`, imageLoadResults);
    }

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
    if (page) {
      try {
        await page.close();
      } catch (pageErr) {
        console.error('[Puppeteer] Error al cerrar pestaña:', pageErr.message);
      }
    }
    releasePageSlot();
  }
}

/**
 * Genera un PDF compilado en lote a partir de una lista de SKUs, plantillas y copias.
 * Soporta lotes híbridos entre productos con diseño Estándar y productos con diseño Máster ROBUST.
 * 
 * @async
 * @param {Array<{sku: string, template: string, cantidad: number}>} items - Lista de items a imprimir
 * @param {Object} [ds] - Servicio de datos (dataService)
 * @returns {Promise<Buffer>} Buffer del PDF del lote completo
 */
export async function generatePdfBatch(items, ds = dataService) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No se enviaron elementos para la impresión por lote.');
  }

  const templatePath = path.join(__dirname, '../templates/template_lote_flejes.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`La plantilla de lote no existe en: ${templatePath}`);
  }
  let baseHtml = fs.readFileSync(templatePath, 'utf8');

  const a4Pages = [];
  const fleje3Cards = [];
  const fleje2Cards = [];

  const resolvedItems = await Promise.all(
    items.map(async (item) => {
      try {
        const [producto, ficha_tecnica, ean] = await Promise.all([
          ds.getProductoBySku(item.sku),
          ds.getFichaBySku(item.sku),
          ds.getEanBySku(item.sku)
        ]);
        if (!producto || !ficha_tecnica) return null;
        return { item, producto, ficha_tecnica, ean: ean || 'SIN EAN' };
      } catch (err) {
        console.error(`[generateBatchPdf] Error resolviendo SKU ${item.sku} en lote:`, err.message);
        return null;
      }
    })
  );

  const validItems = resolvedItems.filter(Boolean);
  if (validItems.length === 0) {
    throw new Error('Ninguno de los SKUs del lote fue encontrado en la base de datos.');
  }

  const selloGarantiaImg = getWarrantySealBase64();

  for (const resolved of validItems) {
    const { item, producto, ficha_tecnica, ean } = resolved;
    const specData = ficha_tecnica.especificaciones_json || ficha_tecnica.datos_especificos || {};
    
    let rawSpecs = [];
    if (Array.isArray(ficha_tecnica.especificaciones) && ficha_tecnica.especificaciones.length > 0) {
      rawSpecs = ficha_tecnica.especificaciones;
    } else if (Array.isArray(specData.especificaciones) && specData.especificaciones.length > 0) {
      rawSpecs = specData.especificaciones;
    }

    const specs = rawSpecs.map(e => ({
      clave: e.clave || e.label || e.nombre || '',
      valor: e.valor || e.value || ''
    }));

    const brandName = producto.marca || specData.marca || ficha_tecnica.marca || 'GENERICA';
    const templateName = item.template || 'fleje3';
    const brandLower = brandName.toLowerCase().trim();
    const isRobust = brandLower.includes('robust') || (templateName || '').toLowerCase().includes('robust');

    const { headerBrandHtml } = await processBrandLogo(brandName, templateName);

    const potenciaSpec = specs.find(s => 
      (s.clave || '').toLowerCase().includes('potencia') || 
      (s.clave || '').toLowerCase().includes('voltaje') ||
      (s.clave || '').toLowerCase().includes('capacidad')
    );
    const destacado = potenciaSpec ? potenciaSpec.valor : '';
    const { destacadoVal, destacadoLbl, mostrarPill } = getHighlightPill(specs, destacado);
    const esElectrico = isElectricTool(specs);

    const origenSpec = specs.find(s => (s.clave || '').toLowerCase().includes('origen') || (s.clave || '').toLowerCase().includes('país'));
    const origenVal = (origenSpec && origenSpec.valor && origenSpec.valor.trim() !== '-') ? origenSpec.valor.trim().toUpperCase() : null;
    const garantiaSpec = specs.find(s => (s.clave || '').toLowerCase().includes('garant'));
    const garantiaVal = (garantiaSpec && garantiaSpec.valor && garantiaSpec.valor.trim() !== '-') ? garantiaSpec.valor.trim().toUpperCase() : null;

    let metaItemsHtml = '';
    if (origenVal) metaItemsHtml += `<span class="meta-text">ORIGEN: ${escapeHtml(origenVal)}</span>`;
    if (garantiaVal) metaItemsHtml += `<span class="meta-text">GARANTÍA: ${escapeHtml(garantiaVal)}</span>`;
    const metaInfoHtml = metaItemsHtml ? `<div class="meta-info">${metaItemsHtml}</div>` : '';

    const tipo_herramienta = specData.tipo_herramienta || ficha_tecnica.tipo_herramienta || producto.descripcion || 'HERRAMIENTA';
    const foto_url = ficha_tecnica.foto_url || 'https://placehold.co/400x300?text=Sin+Foto';

    // División del título en dos líneas
    const tipoHerramientaStr = tipo_herramienta;
    const descWords = tipoHerramientaStr.trim().split(' ');
    let tituloLinea1 = descWords[0] || 'HERRAMIENTA';
    let tituloLinea2 = descWords.slice(1).join(' ') || '';

    if (descWords.length >= 2 && ['SET', 'KIT', 'COMBO', 'JUEGO'].includes(descWords[0].toUpperCase())) {
      tituloLinea1 = descWords[0] + ' ' + descWords[1];
      tituloLinea2 = descWords.slice(2).join(' ');
    }

    const bodySpecs = specs.filter(s => {
      const k = (s.clave || '').toLowerCase();
      return !k.includes('garant') && !k.includes('origen') && !k.includes('país');
    });
    const specsListHtml = formatSpecsListHtml(bodySpecs, 7);

    const mostrarSelloGarantia = esElectrico && !garantiaVal;

    function extractCardHtml(htmlContent, isRobust, templateType) {
      const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      let bodyContent = bodyMatch ? bodyMatch[1].trim() : htmlContent.trim();
      
      if (templateType === 'fleje3') {
        const targetClass = isRobust ? 'card-robust-fleje3' : 'card-fleje3';
        bodyContent = bodyContent.replace(/class="card"/i, `class="${targetClass}"`);
      } else if (templateType === 'fleje2') {
        const targetClass = isRobust ? 'card-robust-fleje2' : 'card-fleje2';
        bodyContent = bodyContent.replace(/class="card"/i, `class="${targetClass}"`);
      } else if (templateType === 'a4') {
        if (isRobust) {
          bodyContent = bodyContent.replace(/class="container"/i, 'class="page-robust-a4"');
        } else {
          bodyContent = bodyContent.replace(/class="card"/i, 'class="page-a4"');
        }
      }
      return bodyContent;
    }

    if (templateName === 'a4' || templateName === 'robust_a4') {
      let a4Html = loadTemplate('a4', isRobust ? 'ROBUST' : brandName);

      a4Html = a4Html.replace(/\{\{tipo_herramienta\}\}/g, escapeHtml(tipo_herramienta));
      a4Html = a4Html.replace(/\{\{destacado\}\}/g, escapeHtml(destacado));
      a4Html = a4Html.replace(/\{\{titulo_linea1\}\}/g, escapeHtml(tituloLinea1));
      a4Html = a4Html.replace(/\{\{titulo_linea2\}\}/g, escapeHtml(tituloLinea2));
      a4Html = a4Html.replace(/\{\{destacado_val\}\}/g, escapeHtml(destacadoVal));
      a4Html = a4Html.replace(/\{\{destacado_lbl\}\}/g, escapeHtml(destacadoLbl));
      a4Html = a4Html.replace(/\{\{pill_display\}\}/g, mostrarPill ? 'inline-flex' : 'none');
      a4Html = a4Html.replace(/\{\{warranty_seal_display\}\}/g, mostrarSelloGarantia ? 'flex' : 'none');
      a4Html = a4Html.replace(/\{\{specs_html\}\}/g, specsListHtml);
      a4Html = a4Html.replace(/\{\{garantia_sello_img\}\}/g, selloGarantiaImg);
      a4Html = a4Html.replace(/\{\{marca\}\}/g, headerBrandHtml);
      a4Html = a4Html.replace(/\{\{sku\}\}/g, escapeHtml(producto.sku));
      a4Html = a4Html.replace(/\{\{ean\}\}/g, escapeHtml(ean));
      a4Html = a4Html.replace(/\{\{descripcion\}\}/g, escapeHtml(producto.descripcion || ''));
      a4Html = a4Html.replace(/\{\{proveedor\}\}/g, escapeHtml(producto.proveedor || 'DESCONOCIDO'));
      a4Html = a4Html.replace(/\{\{foto_url\}\}/g, foto_url);
      a4Html = a4Html.replace(/\{\{origen\}\}/g, escapeHtml(origenVal || 'S/D'));
      a4Html = a4Html.replace(/\{\{garantia\}\}/g, escapeHtml(garantiaVal || '6 Meses'));
      a4Html = a4Html.replace(/\{\{meta_info_html\}\}/g, metaInfoHtml);

      const cardBody = extractCardHtml(a4Html, isRobust, 'a4');
      for (let c = 0; c < (item.cantidad || 1); c++) {
        a4Pages.push(cardBody);
      }
    } else if (templateName === 'fleje3' || templateName === 'robust_fleje3') {
      let cardHtml = loadTemplate('fleje3', isRobust ? 'ROBUST' : brandName);

      cardHtml = cardHtml.replace(/\{\{tipo_herramienta\}\}/g, escapeHtml(tipo_herramienta));
      cardHtml = cardHtml.replace(/\{\{destacado\}\}/g, escapeHtml(destacado));
      cardHtml = cardHtml.replace(/\{\{titulo_linea1\}\}/g, escapeHtml(tituloLinea1));
      cardHtml = cardHtml.replace(/\{\{titulo_linea2\}\}/g, escapeHtml(tituloLinea2));
      cardHtml = cardHtml.replace(/\{\{destacado_val\}\}/g, escapeHtml(destacadoVal));
      cardHtml = cardHtml.replace(/\{\{destacado_lbl\}\}/g, escapeHtml(destacadoLbl));
      cardHtml = cardHtml.replace(/\{\{pill_display\}\}/g, mostrarPill ? 'inline-flex' : 'none');
      cardHtml = cardHtml.replace(/\{\{warranty_seal_display\}\}/g, mostrarSelloGarantia ? 'flex' : 'none');
      cardHtml = cardHtml.replace(/\{\{specs_html\}\}/g, specsListHtml);
      cardHtml = cardHtml.replace(/\{\{garantia_sello_img\}\}/g, selloGarantiaImg);
      cardHtml = cardHtml.replace(/\{\{marca\}\}/g, headerBrandHtml);
      cardHtml = cardHtml.replace(/\{\{sku\}\}/g, escapeHtml(producto.sku));
      cardHtml = cardHtml.replace(/\{\{ean\}\}/g, escapeHtml(ean));
      cardHtml = cardHtml.replace(/\{\{descripcion\}\}/g, escapeHtml(producto.descripcion || ''));
      cardHtml = cardHtml.replace(/\{\{proveedor\}\}/g, escapeHtml(producto.proveedor || 'DESCONOCIDO'));
      cardHtml = cardHtml.replace(/\{\{foto_url\}\}/g, foto_url);
      cardHtml = cardHtml.replace(/\{\{origen\}\}/g, escapeHtml(origenVal || 'S/D'));
      cardHtml = cardHtml.replace(/\{\{garantia\}\}/g, escapeHtml(garantiaVal || '6 Meses'));
      cardHtml = cardHtml.replace(/\{\{meta_info_html\}\}/g, metaInfoHtml);
      
      const cardBody = extractCardHtml(cardHtml, isRobust, 'fleje3');
      for (let c = 0; c < (item.cantidad || 1); c++) {
        fleje3Cards.push(cardBody);
      }
    } else if (templateName === 'fleje2' || templateName === 'robust_fleje2') {
      let cardHtml = loadTemplate('fleje2', isRobust ? 'ROBUST' : brandName);

      cardHtml = cardHtml.replace(/\{\{tipo_herramienta\}\}/g, escapeHtml(tipo_herramienta));
      cardHtml = cardHtml.replace(/\{\{destacado\}\}/g, escapeHtml(destacado));
      cardHtml = cardHtml.replace(/\{\{titulo_linea1\}\}/g, escapeHtml(tituloLinea1));
      cardHtml = cardHtml.replace(/\{\{titulo_linea2\}\}/g, escapeHtml(tituloLinea2));
      cardHtml = cardHtml.replace(/\{\{destacado_val\}\}/g, escapeHtml(destacadoVal));
      cardHtml = cardHtml.replace(/\{\{destacado_lbl\}\}/g, escapeHtml(destacadoLbl));
      cardHtml = cardHtml.replace(/\{\{pill_display\}\}/g, mostrarPill ? 'inline-flex' : 'none');
      cardHtml = cardHtml.replace(/\{\{warranty_seal_display\}\}/g, mostrarSelloGarantia ? 'flex' : 'none');
      cardHtml = cardHtml.replace(/\{\{specs_html\}\}/g, specsListHtml);
      cardHtml = cardHtml.replace(/\{\{garantia_sello_img\}\}/g, selloGarantiaImg);
      cardHtml = cardHtml.replace(/\{\{marca\}\}/g, headerBrandHtml);
      cardHtml = cardHtml.replace(/\{\{sku\}\}/g, escapeHtml(producto.sku));
      cardHtml = cardHtml.replace(/\{\{ean\}\}/g, escapeHtml(ean));
      cardHtml = cardHtml.replace(/\{\{descripcion\}\}/g, escapeHtml(producto.descripcion || ''));
      cardHtml = cardHtml.replace(/\{\{proveedor\}\}/g, escapeHtml(producto.proveedor || 'DESCONOCIDO'));
      cardHtml = cardHtml.replace(/\{\{foto_url\}\}/g, foto_url);
      cardHtml = cardHtml.replace(/\{\{origen\}\}/g, escapeHtml(origenVal || 'S/D'));
      cardHtml = cardHtml.replace(/\{\{garantia\}\}/g, escapeHtml(garantiaVal || '6 Meses'));
      cardHtml = cardHtml.replace(/\{\{meta_info_html\}\}/g, metaInfoHtml);
      
      const cardBody = extractCardHtml(cardHtml, isRobust, 'fleje2');
      for (let c = 0; c < (item.cantidad || 1); c++) {
        fleje2Cards.push(cardBody);
      }
    }
  }

  // Compilar grillas A4 paginadas
  const finalPages = [];
  a4Pages.forEach(p => finalPages.push(p));

  // Fleje 3: 6 tarjetas por página A4
  for (let i = 0; i < fleje3Cards.length; i += 6) {
    const chunk = fleje3Cards.slice(i, i + 6);
    finalPages.push(`
    <div class="page page-fleje3">
      ${chunk.join('\n')}
    </div>`);
  }

  // Fleje 2: 12 tarjetas por página A4
  for (let i = 0; i < fleje2Cards.length; i += 12) {
    const chunk = fleje2Cards.slice(i, i + 12);
    finalPages.push(`
    <div class="page page-fleje2">
      ${chunk.join('\n')}
    </div>`);
  }

  if (finalPages.length === 0) {
    throw new Error('No se compilaron páginas válidas para impresión por lote.');
  }

  const finalHtml = baseHtml.replace('{{content}}', finalPages.join('\n'));

  // Adquirir un slot del semáforo de concurrencia antes de abrir la pestaña
  await acquirePageSlot();

  // Renderizar PDF con Puppeteer Browser Pool
  const browser = await getBrowser();
  let page = null;

  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
    await page.setContent(finalHtml, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Esperar a que todas las imágenes del lote se hayan descargado por completo
    const batchImageLoadResults = await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll('img'));
      const failed = [];
      await Promise.all(images.map(img => {
        if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
        return new Promise(resolve => {
          let done = false;
          let timer = null;
          img.addEventListener('load', () => {
            if (!done) {
              done = true;
              if (timer) clearTimeout(timer);
              resolve();
            }
          }, { once: true });
          img.addEventListener('error', () => {
            if (!done) {
              done = true;
              if (timer) clearTimeout(timer);
              failed.push({ src: img.src, reason: 'NETWORK_ERROR' });
              resolve();
            }
          }, { once: true });
          timer = setTimeout(() => {
            if (!done) {
              done = true;
              failed.push({ src: img.src, reason: 'TIMEOUT_3S' });
              resolve();
            }
          }, 3000);
        });
      }));
      return failed;
    }).catch(err => {
      console.warn('[Puppeteer] Advertencia en evaluación de imágenes de lote:', err.message);
      return [];
    });

    if (batchImageLoadResults && batchImageLoadResults.length > 0) {
      console.warn(`[Puppeteer] ⚠️ Fallo al cargar ${batchImageLoadResults.length} imagen(es) en el lote:`, batchImageLoadResults);
    }

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
    if (page) {
      try {
        await page.close();
      } catch (pageErr) {
        console.error('[Puppeteer] Error al cerrar pestaña en lote:', pageErr.message);
      }
    }
    releasePageSlot();
  }
}

// Aliases de exportación para compatibilidad con las rutas de impresion.js
export { 
  generatePdf as generatePdfFromFicha, 
  generatePdfBatch as generateBatchPdf,
  cleanupBrowser 
};
