import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

  // 1. Determinar plantilla y dimensiones físicas
  let templateFileName = 'template_fleje_3.html';
  let width = '90mm';
  let height = '74mm';

  if (templateName === 'a4') {
    templateFileName = 'template_a4.html';
    width = '210mm';
    height = '297mm';
  } else if (templateName === 'fleje2') {
    templateFileName = 'template_fleje_2.html';
    width = '80mm';
    height = '40mm';
  }

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
    'einhell': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Einhell_Logo.svg',
    'bosch': 'https://upload.wikimedia.org/wikipedia/commons/2/29/Bosch-Logo.svg',
    'dewalt': 'https://upload.wikimedia.org/wikipedia/commons/7/74/DeWalt_logo.svg',
    'stanley': 'https://upload.wikimedia.org/wikipedia/commons/8/87/Stanley_Tools_logo.svg',
    'black & decker': 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Black_%26_Decker_logo.svg',
    'black and decker': 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Black_%26_Decker_logo.svg',
    'b&d': 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Black_%26_Decker_logo.svg',
    'makita': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Makita_logo.svg',
    'karcher': 'https://upload.wikimedia.org/wikipedia/commons/8/8b/K%C3%A4rcher_logo.svg',
    'dremel': 'https://upload.wikimedia.org/wikipedia/commons/d/dd/Dremel_logo.svg',
    'gamma': 'https://gammaherramientas.com.ar/wp-content/uploads/2016/09/LogoGamma.png',
    'skil': 'https://upload.wikimedia.org/wikipedia/commons/3/30/Skil_Logo.svg',
    'kushiro': 'https://kushiro.com.ar/img/logo-kushiro.png',
    'dowen pagio': 'https://www.dowenpagio.com.ar/wp-content/themes/dowen-pagio/images/logo.png'
  };

  let logoUrl = null;
  for (const key of Object.keys(brandLogoMap)) {
    if (brandLower.includes(key)) {
      logoUrl = brandLogoMap[key];
      break;
    }
  }

  let headerBrandHtml = brandName;
  if (logoUrl) {
    let logoHeight = '18px';
    if (templateName === 'a4') {
      logoHeight = '32px';
    } else if (templateName === 'fleje2') {
      logoHeight = '12px';
    }
    headerBrandHtml = `<img src="${logoUrl}" alt="${brandName}" style="max-height: ${logoHeight}; max-width: 100%; object-fit: contain; filter: brightness(0) invert(1); display: inline-block; vertical-align: middle;" />`;
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
