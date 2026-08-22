import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dataService } from '../services/dataService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Genera un buffer de PDF a partir de una ficha técnica y su producto usando la plantilla seleccionada.
 * 
 * @param {Object} data - Objeto que contiene { producto, ficha_tecnica, ean }
 * @param {string} templateName - Nombre de la plantilla ('a4' | 'fleje3' | 'fleje2')
 * @returns {Promise<Buffer>} Buffer del PDF listo para ser enviado.
 */
export async function generatePdfFromFicha(data, templateName = 'fleje3') {
  const { producto, ficha_tecnica, ean = 'SIN EAN' } = data;
  const specData = ficha_tecnica.especificaciones_json || {};
  const specs = specData.especificaciones || [];

  // 1. Determinar plantilla y dimensiones físicas (todas se renderizan en un lienzo A4 para evitar recortes físicos en impresoras)
  let templateFileName = 'template_fleje_3.html';
  if (templateName === 'a4') {
    templateFileName = 'template_a4.html';
  } else if (templateName === 'fleje2') {
    templateFileName = 'template_fleje_2.html';
  }

  const width = '210mm';
  const height = '297mm';

  // Leer plantilla HTML
  const templatePath = path.join(__dirname, '..', 'templates', templateFileName);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`La plantilla no existe en la ruta: ${templatePath}`);
  }
  let html = fs.readFileSync(templatePath, 'utf8');

  // Buscar un atributo destacado (usualmente Potencia, Voltaje o Velocidad) para el subtítulo del header
  const potenciaSpec = specs.find(s => 
    s.clave.toLowerCase().includes('potencia') || 
    s.clave.toLowerCase().includes('voltaje') ||
    s.clave.toLowerCase().includes('capacidad')
  );
  const destacado = potenciaSpec ? potenciaSpec.valor : '';

  // Buscar Origen y Garantía en las especificaciones o usar valores por defecto
  const origenSpec = specs.find(s => s.clave.toLowerCase().includes('origen') || s.clave.toLowerCase().includes('país'));
  const origen = origenSpec ? origenSpec.valor.toUpperCase() : 'CHINA';

  const garantiaSpec = specs.find(s => s.clave.toLowerCase().includes('garant'));
  const garantia = garantiaSpec ? garantiaSpec.valor.toUpperCase() : '1 AÑO';

  const aprobado_por = ficha_tecnica.aprobado_por || 'OPERADOR_LOCAL';

  // Remplazos básicos globales en el HTML usando Regex
  html = html.replace(/\{\{tipo_herramienta\}\}/g, specData.tipo_herramienta || 'HERRAMIENTA');
  html = html.replace(/\{\{destacado\}\}/g, destacado);
  // Resolver el logo de la marca (si está disponible en nuestra base de logotipos oficiales vectoriales)
  const brandName = (specData.marca || 'GENERICA').trim();
  const brandLower = brandName.toLowerCase();
  
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

  let logoUrl = null;

  // 1. Intentar resolver de la base de datos de marcas (Supabase)
  try {
    const dbBrand = await dataService.getMarcaBySlug(brandLower);
    if (dbBrand && dbBrand.logo_url) {
      logoUrl = dbBrand.logo_url;
    }
  } catch (dbErr) {
    console.warn(`[pdfGenerator] No se pudo consultar la marca "${brandLower}" en DB:`, dbErr.message);
  }

  // 2. Fallback a mapeo estático si no se encuentra en DB
  if (!logoUrl) {
    for (const key of Object.keys(brandLogoMap)) {
      if (brandLower.includes(key)) {
        logoUrl = brandLogoMap[key];
        break;
      }
    }
  }

  let headerBrandHtml = brandName;
  if (logoUrl) {
    let logoHeight = '24px'; // Por defecto para Fleje 3 (90x74mm)
    if (templateName === 'a4') {
      logoHeight = '50px';
    } else if (templateName === 'fleje2') {
      logoHeight = '16px'; // Para Fleje 2 (80x40mm)
    }

    try {
      // Intentar descargar y optimizar el SVG al vuelo para mayor velocidad e incrustación inline
      const response = await fetch(logoUrl, { 
        headers: { 'User-Agent': 'FichasEasyAgent/1.0 (contact@easy.com.ar)' } 
      });
      
      if (response.ok) {
        let svgText = await response.text();
        
        // Optimizar DeWalt: ocultar fondo amarillo y colorear letras negras a amarillo institucional DeWalt (#febd18)
        if (brandLower.includes('dewalt')) {
          svgText = svgText.replace(/fill:#febd18/g, 'fill:none;display:none');
          svgText = svgText.replace(/fill:#000000/g, 'fill:#febd18');
          svgText = svgText.replace(/fill="#000000"/g, 'fill="#febd18"');
        } else if (brandLower.includes('karcher') || brandLower.includes('kärcher')) {
          // Kärcher utiliza letras sin atributo fill (negras por defecto) y un rectángulo de clase .f
          svgText = svgText.replace(/<\/style>/g, 'path, polygon { fill: #ffffff !important; }</style>');
        } else {
          // Convertir rellenos y trazos negros a blanco para legibilidad en el fondo oscuro
          svgText = svgText.replace(/fill:#000000/g, 'fill:#ffffff');
          svgText = svgText.replace(/fill="#000000"/g, 'fill="#ffffff"');
          svgText = svgText.replace(/fill="#000"/g, 'fill="#ffffff"');
          svgText = svgText.replace(/fill="black"/g, 'fill="white"');
          
          svgText = svgText.replace(/stroke:#000000/g, 'stroke:#ffffff');
          svgText = svgText.replace(/stroke="#000000"/g, 'stroke="#ffffff"');
          svgText = svgText.replace(/stroke="#000"/g, 'stroke="#ffffff"');
          svgText = svgText.replace(/stroke="black"/g, 'stroke="white"');
        }

        const base64Svg = Buffer.from(svgText).toString('base64');
        headerBrandHtml = `<img src="data:image/svg+xml;base64,${base64Svg}" alt="${brandName}" style="max-height: ${logoHeight}; max-width: 100%; object-fit: contain; display: inline-block; vertical-align: middle;" />`;
      } else {
        // Fallback a URL externa directa en caso de error HTTP en la descarga
        headerBrandHtml = `<img src="${logoUrl}" alt="${brandName}" style="max-height: ${logoHeight}; max-width: 100%; object-fit: contain; display: inline-block; vertical-align: middle;" />`;
      }
    } catch (fetchErr) {
      console.warn(`[pdfGenerator] Error al descargar/procesar logo para ${brandName}:`, fetchErr.message);
      // Fallback a URL externa directa en caso de error de red
      headerBrandHtml = `<img src="${logoUrl}" alt="${brandName}" style="max-height: ${logoHeight}; max-width: 100%; object-fit: contain; display: inline-block; vertical-align: middle;" />`;
    }
  }

  html = html.replace(/\{\{marca\}\}/g, headerBrandHtml);
  html = html.replace(/\{\{sku\}\}/g, producto.sku);
  html = html.replace(/\{\{ean\}\}/g, ean);
  html = html.replace(/\{\{descripcion\}\}/g, producto.descripcion || '');
  html = html.replace(/\{\{proveedor\}\}/g, producto.proveedor || 'DESCONOCIDO');
  html = html.replace(/\{\{foto_url\}\}/g, ficha_tecnica.foto_url || 'https://placehold.co/400x300?text=Sin+Foto');
  html = html.replace(/\{\{origen\}\}/g, origen);
  html = html.replace(/\{\{garantia\}\}/g, garantia);
  html = html.replace(/\{\{aprobado_por\}\}/g, aprobado_por);

  // Mapear hasta 5 especificaciones principales (spec1 a spec5)
  for (let i = 0; i < 5; i++) {
    const spec = specs[i];
    if (spec) {
      html = html.replace(new RegExp(`\\{\\{spec${i+1}_label\\}\\}`, 'g'), spec.clave || '-');
      html = html.replace(new RegExp(`\\{\\{spec${i+1}_value\\}\\}`, 'g'), spec.valor || '-');
    } else {
      html = html.replace(new RegExp(`\\{\\{spec${i+1}_label\\}\\}`, 'g'), '-');
      html = html.replace(new RegExp(`\\{\\{spec${i+1}_value\\}\\}`, 'g'), '-');
    }
  }

  // Lanzar Puppeteer para generar el PDF
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Setear contenido HTML
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generar PDF con dimensiones exactas
    const pdfBuffer = await page.pdf({
      width,
      height,
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
    await browser.close();
  }
}

/**
 * Genera un PDF compilado en lote a partir de una lista de productos, sus plantillas y copias.
 * 
 * @param {Array} items - Lista de items [{ sku, template, cantidad }]
 * @param {Object} dataService - Abstracción de acceso a datos
 * @returns {Promise<Buffer>} Buffer del PDF del lote completo
 */
export async function generateBatchPdf(items, dataService) {
  // 1. Leer plantilla base del lote
  const templatePath = path.join(__dirname, '..', 'templates', 'template_lote_flejes.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`La plantilla de lote no existe en: ${templatePath}`);
  }
  let baseHtml = fs.readFileSync(templatePath, 'utf8');

  // Arrays de páginas compiladas
  const a4Pages = [];
  const fleje3Cards = [];
  const fleje2Cards = [];

  // Mapeo de logotipos
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

  // Resolver datos de cada SKU en paralelo
  const resolvedItems = await Promise.all(
    items.map(async (item) => {
      try {
        const [producto, ficha_tecnica, ean] = await Promise.all([
          dataService.getProductoBySku(item.sku),
          dataService.getFichaBySku(item.sku),
          dataService.getEanBySku(item.sku)
        ]);
        if (!producto || !ficha_tecnica) return null;
        return { item, producto, ficha_tecnica, ean: ean || 'SIN EAN' };
      } catch (err) {
        console.error(`Error resolviendo SKU ${item.sku} en lote:`, err);
        return null;
      }
    })
  );

  // Procesar y compilar cada cartel
  for (const resolved of resolvedItems) {
    if (!resolved) continue;
    const { item, producto, ficha_tecnica, ean } = resolved;
    const specData = ficha_tecnica.especificaciones_json || {};
    const specs = specData.especificaciones || [];
    const brandName = (specData.marca || 'GENERICA').trim();
    const brandLower = brandName.toLowerCase();
    const templateName = item.template || 'fleje3';

    // Buscar Origen y Garantía
    const origenSpec = specs.find(s => s.clave.toLowerCase().includes('origen') || s.clave.toLowerCase().includes('país'));
    const origen = origenSpec ? origenSpec.valor.toUpperCase() : 'CHINA';
    const garantiaSpec = specs.find(s => s.clave.toLowerCase().includes('garant'));
    const garantia = garantiaSpec ? garantiaSpec.valor.toUpperCase() : '1 AÑO';

    // Determinar destacado y logo
    const potenciaSpec = specs.find(s => 
      s.clave.toLowerCase().includes('potencia') || 
      s.clave.toLowerCase().includes('voltaje') ||
      s.clave.toLowerCase().includes('capacidad')
    );
    const destacado = potenciaSpec ? potenciaSpec.valor : '';

    let logoUrl = null;

    // 1. Intentar resolver de la base de datos de marcas (Supabase)
    try {
      const dbBrand = await dataService.getMarcaBySlug(brandLower);
      if (dbBrand && dbBrand.logo_url) {
        logoUrl = dbBrand.logo_url;
      }
    } catch (dbErr) {
      console.warn(`[pdfGenerator] No se pudo consultar la marca "${brandLower}" en DB para lote:`, dbErr.message);
    }

    // 2. Fallback a mapeo estático si no se encuentra en DB
    if (!logoUrl) {
      for (const key of Object.keys(brandLogoMap)) {
        if (brandLower.includes(key)) {
          logoUrl = brandLogoMap[key];
          break;
        }
      }
    }

    let headerBrandHtml = brandName;
    if (logoUrl) {
      const logoHeight = templateName === 'a4' ? '40px' : templateName === 'fleje2' ? '16px' : '24px';
      try {
        const response = await fetch(logoUrl, { 
          headers: { 'User-Agent': 'FichasEasyAgent/1.0 (contact@easy.com.ar)' } 
        });
        if (response.ok) {
          let svgText = await response.text();
          if (brandLower.includes('dewalt')) {
            svgText = svgText.replace(/fill:#febd18/g, 'fill:none;display:none');
            svgText = svgText.replace(/fill:#000000/g, 'fill:#febd18');
          } else if (brandLower.includes('karcher') || brandLower.includes('kärcher')) {
            svgText = svgText.replace(/<\/style>/g, 'path, polygon { fill: #ffffff !important; }</style>');
          } else {
            svgText = svgText.replace(/fill:#000000/g, 'fill:#ffffff');
            svgText = svgText.replace(/fill="#000000"/g, 'fill="#ffffff"');
            svgText = svgText.replace(/stroke:#000000/g, 'stroke:#ffffff');
            svgText = svgText.replace(/stroke="#000000"/g, 'stroke="#ffffff"');
          }
          const base64Svg = Buffer.from(svgText).toString('base64');
          headerBrandHtml = `<img src="data:image/svg+xml;base64,${base64Svg}" alt="${brandName}" style="max-height: ${logoHeight}; max-width: 100%; object-fit: contain;" />`;
        } else {
          headerBrandHtml = `<img src="${logoUrl}" alt="${brandName}" style="max-height: ${logoHeight}; max-width: 100%; object-fit: contain;" />`;
        }
      } catch (err) {
        headerBrandHtml = `<img src="${logoUrl}" alt="${brandName}" style="max-height: ${logoHeight}; max-width: 100%; object-fit: contain;" />`;
      }
    }

    const tipo_herramienta = specData.tipo_herramienta || 'HERRAMIENTA';
    const foto_url = ficha_tecnica.foto_url || 'https://placehold.co/400x300?text=Sin+Foto';

    // Compilar segun la plantilla
    if (templateName === 'a4') {
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

      const a4PageHtml = `
      <div class="page page-a4">
        <!-- Header -->
        <div class="header">
            <div class="header-left">
                <span class="header-title">${tipo_herramienta}</span>
                <span class="header-subtitle">${destacado}</span>
            </div>
            <div class="header-right">
                <span class="header-brand">${headerBrandHtml}</span>
                <span class="header-sku">SAP ${producto.sku}</span>
            </div>
        </div>

        <!-- Body Grid -->
        <div class="body-grid">
            <!-- Columna Izquierda (4 especificaciones principales) -->
            <div class="specs-column">
                <div class="spec-cell">
                    <span class="spec-label">${spec1_label}</span>
                    <span class="spec-value">${spec1_value}</span>
                </div>
                <div class="spec-cell">
                    <span class="spec-label">${spec2_label}</span>
                    <span class="spec-value">${spec2_value}</span>
                </div>
                <div class="spec-cell">
                    <span class="spec-label">${spec3_label}</span>
                    <span class="spec-value">${spec3_value}</span>
                </div>
                <div class="spec-cell">
                    <span class="spec-label">${spec4_label}</span>
                    <span class="spec-value">${spec4_value}</span>
                </div>
            </div>

            <!-- Columna Derecha (Foto del Producto) -->
            <div class="image-column">
                <img class="product-image" src="${foto_url}" alt="Foto Producto" />
            </div>
        </div>

        <!-- Footer Grid (3 especificaciones complementarias/origen/garantia) -->
        <div class="footer-grid">
            <div class="footer-cell">
                <span class="footer-label">${spec5_label}</span>
                <span class="footer-value">${spec5_value}</span>
            </div>
            <div class="footer-cell">
                <span class="footer-label">Origen</span>
                <span class="footer-value">${origen}</span>
            </div>
            <div class="footer-cell">
                <span class="footer-label">Garantía</span>
                <span class="footer-value">${garantia}</span>
            </div>
        </div>

        <!-- Franja Inferior -->
        <div class="bottom-bar"></div>
      </div>`;

      // Agregar copias
      for (let c = 0; c < (item.cantidad || 1); c++) {
        a4Pages.push(a4PageHtml);
      }
    } else if (templateName === 'fleje3') {
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

      const cardHtml = `
      <div class="card-fleje3">
        <div class="header">
          <div class="header-left">
            <span class="header-title">${tipo_herramienta}</span>
            <span class="header-subtitle">${destacado}</span>
          </div>
          <div class="header-right">
            ${headerBrandHtml}
            <span class="header-sku">SAP ${producto.sku}</span>
          </div>
        </div>
        <div class="body-grid">
          <div class="specs-column">
            <div class="spec-cell">
              <span class="spec-label">${spec1_label}</span>
              <span class="spec-value">${spec1_value}</span>
            </div>
            <div class="spec-cell">
              <span class="spec-label">${spec2_label}</span>
              <span class="spec-value">${spec2_value}</span>
            </div>
            <div class="spec-cell">
              <span class="spec-label">${spec3_label}</span>
              <span class="spec-value">${spec3_value}</span>
            </div>
            <div class="spec-cell">
              <span class="spec-label">${spec4_label}</span>
              <span class="spec-value">${spec4_value}</span>
            </div>
          </div>
          <div class="image-column">
            <img class="product-image" src="${foto_url}" />
          </div>
        </div>
        <div class="footer-grid">
          <div class="footer-cell">
            <span class="footer-label">${spec5_label}</span>
            <span class="footer-value">${spec5_value}</span>
          </div>
          <div class="footer-cell">
            <span class="footer-label">Origen</span>
            <span class="footer-value">${origen}</span>
          </div>
          <div class="footer-cell">
            <span class="footer-label">Garantía</span>
            <span class="footer-value">${garantia}</span>
          </div>
        </div>
        <div class="bottom-bar"></div>
      </div>`;

      for (let c = 0; c < (item.cantidad || 1); c++) {
        fleje3Cards.push(cardHtml);
      }
    } else if (templateName === 'fleje2') {
      const spec1_label = specs[0]?.clave || '-';
      const spec1_value = specs[0]?.valor || '-';
      const spec2_label = specs[1]?.clave || '-';
      const spec2_value = specs[1]?.valor || '-';
      const spec3_label = specs[2]?.clave || '-';
      const spec3_value = specs[2]?.valor || '-';

      const cardHtml = `
      <div class="card-fleje2">
        <div class="header">
          <div class="header-left">
            <span class="header-title">${tipo_herramienta}</span>
            <span class="header-subtitle">${destacado}</span>
          </div>
          <div class="header-right">
            ${headerBrandHtml}
            <span class="header-sku">SAP ${producto.sku}</span>
          </div>
        </div>
        <div class="body-grid">
          <div class="specs-column">
            <div class="spec-cell">
              <span class="spec-label">${spec1_label}</span>
              <span class="spec-value">${spec1_value}</span>
            </div>
            <div class="spec-cell">
              <span class="spec-label">${spec2_label}</span>
              <span class="spec-value">${spec2_value}</span>
            </div>
            <div class="spec-cell">
              <span class="spec-label">${spec3_label}</span>
              <span class="spec-value">${spec3_value}</span>
            </div>
          </div>
          <div class="image-column">
            <img class="product-image" src="${foto_url}" />
          </div>
        </div>
        <div class="footer-grid">
          <div class="footer-cell">
            <span class="footer-label">Origen</span>
            <span class="footer-value">${origen}</span>
          </div>
          <div class="footer-cell">
            <span class="footer-label">Garantía</span>
            <span class="footer-value">${garantia}</span>
          </div>
        </div>
        <div class="bottom-bar"></div>
      </div>`;

      for (let c = 0; c < (item.cantidad || 1); c++) {
        fleje2Cards.push(cardHtml);
      }
    }
  }

  // 3. Compilar grillas A4 paginadas
  const finalPages = [];

  // Pestañas A4 completas
  a4Pages.forEach(p => finalPages.push(p));

  // Fleje 3: 6 por página
  for (let i = 0; i < fleje3Cards.length; i += 6) {
    const chunk = fleje3Cards.slice(i, i + 6);
    finalPages.push(`
    <div class="page page-fleje3">
      ${chunk.join('\n')}
    </div>`);
  }

  // Fleje 2: 12 por página
  for (let i = 0; i < fleje2Cards.length; i += 12) {
    const chunk = fleje2Cards.slice(i, i + 12);
    finalPages.push(`
    <div class="page page-fleje2">
      ${chunk.join('\n')}
    </div>`);
  }

  // Si no se compiló ninguna página válida, lanzar error
  if (finalPages.length === 0) {
    throw new Error('No se compilaron páginas válidas para impresión. Verifique los códigos SKU del lote.');
  }

  // Remplazar contenido
  const finalHtml = baseHtml.replace('{{content}}', finalPages.join('\n'));

  // 4. Compilar con Puppeteer
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
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
    await browser.close();
  }
}
