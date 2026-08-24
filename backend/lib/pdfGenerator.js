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

  // Adquirir un slot del semáforo de concurrencia antes de abrir la pestaña
  await acquirePageSlot();

  // Renderizar PDF en lienzo A4 exacto (210mm x 297mm) con márgenes nulos para evitar recortes físicos en impresoras
  const browser = await getBrowser();
  let page = null;

  try {
    page = await browser.newPage();
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
    const origen = origenSpec ? origenSpec.valor.toUpperCase() : 'CHINA';
    const garantiaSpec = specs.find(s => (s.clave || '').toLowerCase().includes('garant'));
    const garantia = garantiaSpec ? garantiaSpec.valor.toUpperCase() : '1 AÑO';

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

    if (templateName === 'a4' || templateName === 'robust_a4') {
      let a4Html = loadTemplate('a4', isRobust ? 'ROBUST' : brandName);
      const specsListHtml = formatSpecsListHtml(specs);

      a4Html = a4Html.replace(/\{\{tipo_herramienta\}\}/g, escapeHtml(tipo_herramienta));
      a4Html = a4Html.replace(/\{\{destacado\}\}/g, escapeHtml(destacado));
      a4Html = a4Html.replace(/\{\{titulo_linea1\}\}/g, escapeHtml(tituloLinea1));
      a4Html = a4Html.replace(/\{\{titulo_linea2\}\}/g, escapeHtml(tituloLinea2));
      a4Html = a4Html.replace(/\{\{destacado_val\}\}/g, escapeHtml(destacadoVal));
      a4Html = a4Html.replace(/\{\{destacado_lbl\}\}/g, escapeHtml(destacadoLbl));
      a4Html = a4Html.replace(/\{\{pill_display\}\}/g, mostrarPill ? 'inline-flex' : 'none');
      a4Html = a4Html.replace(/\{\{warranty_seal_display\}\}/g, esElectrico ? 'flex' : 'none');
      a4Html = a4Html.replace(/\{\{specs_html\}\}/g, specsListHtml);
      a4Html = a4Html.replace(/\{\{garantia_sello_img\}\}/g, selloGarantiaImg);
      a4Html = a4Html.replace(/\{\{marca\}\}/g, headerBrandHtml);
      a4Html = a4Html.replace(/\{\{sku\}\}/g, escapeHtml(producto.sku));
      a4Html = a4Html.replace(/\{\{ean\}\}/g, escapeHtml(ean));
      a4Html = a4Html.replace(/\{\{descripcion\}\}/g, escapeHtml(producto.descripcion || ''));
      a4Html = a4Html.replace(/\{\{proveedor\}\}/g, escapeHtml(producto.proveedor || 'DESCONOCIDO'));
      a4Html = a4Html.replace(/\{\{foto_url\}\}/g, foto_url);
      a4Html = a4Html.replace(/\{\{origen\}\}/g, escapeHtml(origen));
      a4Html = a4Html.replace(/\{\{garantia\}\}/g, escapeHtml(garantia));

      for (let i = 0; i < 5; i++) {
        const spec = specs[i];
        if (spec) {
          a4Html = a4Html.replace(new RegExp(`\\{\\{spec${i+1}_label\\}\\}`, 'g'), escapeHtml(spec.clave || '-'));
          a4Html = a4Html.replace(new RegExp(`\\{\\{spec${i+1}_value\\}\\}`, 'g'), escapeHtml(spec.valor || '-'));
        } else {
          a4Html = a4Html.replace(new RegExp(`\\{\\{spec${i+1}_label\\}\\}`, 'g'), '-');
          a4Html = a4Html.replace(new RegExp(`\\{\\{spec${i+1}_value\\}\\}`, 'g'), '-');
        }
      }

      // Extraer el body del HTML para empaquetarlo como página A4 en el lote
      const bodyMatch = a4Html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const pageInner = bodyMatch ? bodyMatch[1] : a4Html;

      for (let c = 0; c < (item.cantidad || 1); c++) {
        a4Pages.push(`<div class="page page-a4-wrapper" style="width:210mm; height:297mm; page-break-after:always;">${pageInner}</div>`);
      }
    } else if (templateName === 'fleje3' || templateName === 'robust_fleje3') {
      let cardHtml = '';

      if (isRobust) {
        const specsListHtml = specs.slice(0, 4).map(s => 
          `<li class="spec-item"><span class="spec-bullet">·</span><span>${escapeHtml(s.clave)}: ${escapeHtml(s.valor)}</span></li>`
        ).join('');

        cardHtml = `
        <div class="card-robust-fleje3">
          <div style="width: 52%; display: flex; flex-direction: column; justify-content: space-between; z-index: 10;">
            <div>
              <div style="margin-bottom: 2mm; max-height: 8mm; display: flex; align-items: center;">
                ${headerBrandHtml}
              </div>
              <div style="margin-bottom: 2.5mm;">
                <div style="font-size: 14.5pt; font-weight: 900; color: #ffffff; text-transform: uppercase; line-height: 0.95;">${escapeHtml(tituloLinea1)}</div>
                <div style="font-size: 14.5pt; font-weight: 900; color: #ffffff; text-transform: uppercase; line-height: 0.95;">${escapeHtml(tituloLinea2)}</div>
              </div>
              ${mostrarPill ? `<div style="display: inline-flex; align-items: center; gap: 1.5mm; background: #000000; border: 1.2px solid #ffffff; padding: 0.8mm 3mm; border-radius: 1.5mm; margin-bottom: 2.5mm;"><span style="font-size: 10pt; font-weight: 900; color: #ffffff;">${escapeHtml(destacadoVal)}</span><span style="color: #00e5ff; font-size: 8pt;">⚡</span><span style="font-size: 9.5pt; font-weight: 800; color: #00e5ff;">${escapeHtml(destacadoLbl)}</span></div>` : ''}
              <ul style="list-style: none; padding: 0; margin: 0;">
                ${specsListHtml}
              </ul>
            </div>
            <div style="border-top: 1px solid #ffffff; border-bottom: 1px solid #ffffff; padding: 0.8mm 0; width: fit-content;">
              <span style="font-size: 8pt; font-weight: 800; color: #ffffff;">SKU: ${escapeHtml(producto.sku)}</span>
            </div>
          </div>
          <div style="position: absolute; right: 0; top: 0; bottom: 0; width: 48%; display: flex; justify-content: center; align-items: center; padding: 3mm;">
            <img src="${foto_url}" style="max-width: 100%; max-height: 100%; object-fit: contain; mix-blend-mode: multiply;" />
            ${esElectrico && selloGarantiaImg ? `<img src="${selloGarantiaImg}" style="position: absolute; right: 3.5mm; bottom: 3.5mm; width: 16mm; height: 16mm; object-fit: contain; z-index: 20;" />` : ''}
          </div>
        </div>`;
      } else {
        const spec1_label = specs[0]?.clave || '-';
        const spec1_value = specs[0]?.valor || '-';
        const spec2_label = specs[1]?.clave || '-';
        const spec2_value = specs[1]?.valor || '-';
        const spec3_label = specs[2]?.clave || '-';
        const spec3_value = specs[2]?.valor || '-';
        const spec4_label = specs[3]?.clave || '-';
        const spec4_value = specs[3]?.valor || '-';
        const spec5_label = specs[4]?.clave || '-';
        const spec5_value = specs[4]?.valor || '-';

        cardHtml = `
        <div class="card-fleje3">
          <div class="header">
            <div class="header-left">
              <span class="header-title">${escapeHtml(tipo_herramienta)}</span>
              <span class="header-subtitle">${escapeHtml(destacado)}</span>
            </div>
            <div class="header-right">
              ${headerBrandHtml}
              <span class="header-sku">SAP ${escapeHtml(producto.sku)}</span>
            </div>
          </div>
          <div class="body-grid">
            <div class="specs-column">
              <div class="spec-cell">
                <span class="spec-label">${escapeHtml(spec1_label)}</span>
                <span class="spec-value">${escapeHtml(spec1_value)}</span>
              </div>
              <div class="spec-cell">
                <span class="spec-label">${escapeHtml(spec2_label)}</span>
                <span class="spec-value">${escapeHtml(spec2_value)}</span>
              </div>
              <div class="spec-cell">
                <span class="spec-label">${escapeHtml(spec3_label)}</span>
                <span class="spec-value">${escapeHtml(spec3_value)}</span>
              </div>
              <div class="spec-cell">
                <span class="spec-label">${escapeHtml(spec4_label)}</span>
                <span class="spec-value">${escapeHtml(spec4_value)}</span>
              </div>
            </div>
            <div class="image-column">
              <img class="product-image" src="${foto_url}" />
            </div>
          </div>
          <div class="footer-grid">
            <div class="footer-cell">
              <span class="footer-label">${escapeHtml(spec5_label)}</span>
              <span class="footer-value">${escapeHtml(spec5_value)}</span>
            </div>
            <div class="footer-cell">
              <span class="footer-label">Origen</span>
              <span class="footer-value">${escapeHtml(origen)}</span>
            </div>
            <div class="footer-cell">
              <span class="footer-label">Garantía</span>
              <span class="footer-value">${escapeHtml(garantia)}</span>
            </div>
          </div>
          <div class="bottom-bar"></div>
        </div>`;
      }

      for (let c = 0; c < (item.cantidad || 1); c++) {
        fleje3Cards.push(cardHtml);
      }
    } else if (templateName === 'fleje2' || templateName === 'robust_fleje2') {
      let cardHtml = '';

      if (isRobust) {
        const specsListHtml = specs.slice(0, 3).map(s => 
          `<li class="spec-item"><span class="spec-bullet">·</span><span>${escapeHtml(s.clave)}: ${escapeHtml(s.valor)}</span></li>`
        ).join('');

        cardHtml = `
        <div class="card-robust-fleje2">
          <div style="width: 52%; display: flex; flex-direction: column; justify-content: space-between; z-index: 10;">
            <div>
              <div style="margin-bottom: 1mm; max-height: 5.5mm; display: flex; align-items: center;">
                ${headerBrandHtml}
              </div>
              <div style="margin-bottom: 1.5mm;">
                <div style="font-size: 9.5pt; font-weight: 900; color: #ffffff; text-transform: uppercase; line-height: 0.95;">${escapeHtml(tituloLinea1)}</div>
                <div style="font-size: 9.5pt; font-weight: 900; color: #ffffff; text-transform: uppercase; line-height: 0.95;">${escapeHtml(tituloLinea2)}</div>
              </div>
              ${mostrarPill ? `<div style="display: inline-flex; align-items: center; gap: 1mm; background: #000000; border: 1px solid #ffffff; padding: 0.5mm 2mm; border-radius: 1mm; margin-bottom: 1.5mm;"><span style="font-size: 7.5pt; font-weight: 900; color: #ffffff;">${escapeHtml(destacadoVal)}</span><span style="color: #00e5ff; font-size: 6pt;">⚡</span><span style="font-size: 7pt; font-weight: 800; color: #00e5ff;">${escapeHtml(destacadoLbl)}</span></div>` : ''}
              <ul style="list-style: none; padding: 0; margin: 0;">
                ${specsListHtml}
              </ul>
            </div>
            <div style="border-top: 1px solid #ffffff; border-bottom: 1px solid #ffffff; padding: 0.5mm 0; width: fit-content;">
              <span style="font-size: 6.5pt; font-weight: 800; color: #ffffff;">SKU: ${escapeHtml(producto.sku)}</span>
            </div>
          </div>
          <div style="position: absolute; right: 0; top: 0; bottom: 0; width: 48%; display: flex; justify-content: center; align-items: center; padding: 2mm;">
            <img src="${foto_url}" style="max-width: 100%; max-height: 100%; object-fit: contain; mix-blend-mode: multiply;" />
            ${esElectrico && selloGarantiaImg ? `<img src="${selloGarantiaImg}" style="position: absolute; right: 2.5mm; bottom: 2.5mm; width: 11mm; height: 11mm; object-fit: contain; z-index: 20;" />` : ''}
          </div>
        </div>`;
      } else {
        const spec1_label = specs[0]?.clave || '-';
        const spec1_value = specs[0]?.valor || '-';
        const spec2_label = specs[1]?.clave || '-';
        const spec2_value = specs[1]?.valor || '-';
        const spec3_label = specs[2]?.clave || '-';
        const spec3_value = specs[2]?.valor || '-';

        cardHtml = `
        <div class="card-fleje2">
          <div class="header">
            <div class="header-left">
              <span class="header-title">${escapeHtml(tipo_herramienta)}</span>
              <span class="header-subtitle">${escapeHtml(destacado)}</span>
            </div>
            <div class="header-right">
              ${headerBrandHtml}
              <span class="header-sku">SAP ${escapeHtml(producto.sku)}</span>
            </div>
          </div>
          <div class="body-grid">
            <div class="specs-column">
              <div class="spec-cell">
                <span class="spec-label">${escapeHtml(spec1_label)}</span>
                <span class="spec-value">${escapeHtml(spec1_value)}</span>
              </div>
              <div class="spec-cell">
                <span class="spec-label">${escapeHtml(spec2_label)}</span>
                <span class="spec-value">${escapeHtml(spec2_value)}</span>
              </div>
              <div class="spec-cell">
                <span class="spec-label">${escapeHtml(spec3_label)}</span>
                <span class="spec-value">${escapeHtml(spec3_value)}</span>
              </div>
            </div>
            <div class="image-column">
              <img class="product-image" src="${foto_url}" />
            </div>
          </div>
          <div class="footer-grid">
            <div class="footer-cell">
              <span class="footer-label">Origen</span>
              <span class="footer-value">${escapeHtml(origen)}</span>
            </div>
            <div class="footer-cell">
              <span class="footer-label">Garantía</span>
              <span class="footer-value">${escapeHtml(garantia)}</span>
            </div>
          </div>
          <div class="bottom-bar"></div>
        </div>`;
      }

      for (let c = 0; c < (item.cantidad || 1); c++) {
        fleje2Cards.push(cardHtml);
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
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
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
