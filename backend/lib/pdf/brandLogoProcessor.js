import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dataService } from '../../services/dataService.js';

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

const brandLogoMap = {
  'einhell': 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Einhell_Germany_logo.svg',
  'bosch': 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Bosch-Logo.svg',
  'dewalt': 'https://upload.wikimedia.org/wikipedia/commons/8/89/DeWalt_Logo.svg',
  'makita': 'https://upload.wikimedia.org/wikipedia/commons/9/91/Makita_logo.svg',
  'stanley': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Stanley_Black_%26_DeCKER_logo.svg',
  'black&decker': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Stanley_Black_%26_DeCKER_logo.svg',
  'black+decker': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Stanley_Black_%26_DeCKER_logo.svg',
  'skil': 'https://upload.wikimedia.org/wikipedia/commons/6/66/Skil_Logo.svg',
  'dremel': 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Dremel_Logo.svg',
  'karcher': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/K%C3%A4rcher_Logo_2015.svg',
  'kärcher': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/K%C3%A4rcher_Logo_2015.svg',
  'gamma': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Gamma_logo.svg/320px-Gamma_logo.svg.png',
  'robust': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Robust_Logo.png/320px-Robust_Logo.png'
};

/**
 * @fileoverview Procesador de logotipos de marca.
 * Resuelve URLs de logos dinámicos (Supabase) o fallbacks, convierte SVGs a blanco
 * respetando colores corporativos (DeWalt, Bosch) y genera el marcado HTML adaptado al formato.
 */

/**
 * Procesa y genera el HTML del header para el logotipo de la marca.
 * 
 * @async
 * @param {string} brandName - Nombre de la marca (ej: "DEWALT", "ROBUST")
 * @param {string} templateName - Formato ('fleje3', 'fleje2', 'a4')
 * @returns {Promise<{ headerBrandHtml: string, logoUrl: string }>} Objeto con HTML del logo y URL resuelta
 */
export async function processBrandLogo(brandName = '', templateName = 'fleje3') {
  const rawBrand = (brandName || '').trim();
  const normBrand = rawBrand.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const cleanBrand = normBrand.replace(/[^a-z0-9]/g, '');
  let logoUrl = '';

  try {
    const dbBrand = await dataService.getMarcaBySlug(rawBrand) || await dataService.getMarcaBySlug(normBrand);
    if (dbBrand && dbBrand.logo_url) {
      logoUrl = dbBrand.logo_url;
    }
  } catch (dbErr) {
    console.warn(`[BrandLogoProcessor] Marca no hallada en DB para "${brandName}":`, dbErr.message);
  }

  if (!logoUrl) {
    for (const key of Object.keys(brandLogoMap)) {
      const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const cleanKey = normKey.replace(/[^a-z0-9]/g, '');
      if (normBrand.includes(normKey) || (cleanBrand && cleanKey && cleanBrand.includes(cleanKey))) {
        logoUrl = brandLogoMap[key];
        break;
      }
    }
  }

  let headerBrandHtml = `<span class="brand-text">${escapeHtml(brandName)}</span>`;

  if (logoUrl) {
    let logoHeight = '36px';
    if (templateName === 'a4') logoHeight = '55px';
    if (templateName === 'fleje3') logoHeight = '36px';
    if (templateName === 'fleje2') logoHeight = '22px';

    const isRaster = logoUrl.match(/\.(webp|png|jpg|jpeg)(\?.*)?$/i);

    try {
      if (isRaster) {
        headerBrandHtml = `<img src="${logoUrl}" alt="${escapeHtml(brandName)}" style="max-height: ${logoHeight}; max-width: 100%; object-fit: contain; display: inline-block; vertical-align: middle;" />`;
      } else {
        const response = await fetch(logoUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (response.ok) {
          let svgText = await response.text();

          if (normBrand.includes('dewalt') || normBrand.includes('stanley') || normBrand.includes('bosch') || normBrand.includes('einhell') || normBrand.includes('makita') || normBrand.includes('gamma')) {
            // Preservar colores oficiales originales
          } else if (normBrand.includes('karcher')) {
            if (svgText.includes('</style>')) {
              svgText = svgText.replace(/<\/style>/g, 'path, polygon, text { fill: #ffffff !important; }</style>');
            } else {
              svgText = svgText.replace('<svg', '<svg><style>path, polygon, text { fill: #ffffff !important; }</style>');
            }
          } else {
            svgText = svgText.replace(/fill:#000000/g, 'fill:#ffffff')
                             .replace(/fill="#000000"/g, 'fill="#ffffff"')
                             .replace(/fill="#000"/g, 'fill:#ffffff"')
                             .replace(/fill="black"/g, 'fill="white"')
                             .replace(/stroke:#000000/g, 'stroke:#ffffff')
                             .replace(/stroke="#000000"/g, 'stroke:#ffffff')
                             .replace(/stroke="#000"/g, 'stroke:#ffffff')
                             .replace(/stroke="black"/g, 'stroke="white"');
          }

          const base64Svg = Buffer.from(svgText).toString('base64');
          headerBrandHtml = `<img src="data:image/svg+xml;base64,${base64Svg}" alt="${escapeHtml(brandName)}" style="max-height: ${logoHeight}; max-width: 100%; object-fit: contain; display: inline-block; vertical-align: middle;" />`;
        } else {
          // Si el servidor remoto devuelve 404 o error, caer a texto institucional limpio en vez de un icono roto
          headerBrandHtml = `<span class="brand-text">${escapeHtml(brandName)}</span>`;
        }
      }
    } catch (fetchErr) {
      console.warn(`[BrandLogoProcessor] Error al descargar logo de ${brandName}:`, fetchErr.message);
      headerBrandHtml = `<span class="brand-text">${escapeHtml(brandName)}</span>`;
    }
  }

  // Tratamiento especial para plantillas dinámicas ROBUST
  if (normBrand.includes('robust')) {
    let robustLogoHeight = '8mm';
    let robustLogoWidth = '38mm';
    if (templateName === 'a4') {
      robustLogoHeight = '28mm';
      robustLogoWidth = '110mm';
    } else if (templateName === 'fleje2') {
      robustLogoHeight = '5.5mm';
      robustLogoWidth = '26mm';
    }

    if (logoUrl) {
      const isSvg = logoUrl.toLowerCase().includes('.svg');
      if (isSvg) {
        try {
          const response = await fetch(logoUrl);
          if (response.ok) {
            let svgText = await response.text();
            svgText = svgText.replace(/fill:#000000/g, 'fill:#ffffff')
                             .replace(/fill="#000000"/g, 'fill="#ffffff"')
                             .replace(/fill="#000"/g, 'fill="#ffffff"')
                             .replace(/fill="black"/g, 'fill="white"');
            const base64Svg = Buffer.from(svgText).toString('base64');
            headerBrandHtml = `<img src="data:image/svg+xml;base64,${base64Svg}" alt="ROBUST" style="max-height: ${robustLogoHeight}; max-width: ${robustLogoWidth}; object-fit: contain; display: block;" />`;
          } else {
            headerBrandHtml = `<img src="${logoUrl}" alt="ROBUST" style="max-height: ${robustLogoHeight}; max-width: ${robustLogoWidth}; object-fit: contain; display: block;" />`;
          }
        } catch (e) {
          headerBrandHtml = `<img src="${logoUrl}" alt="ROBUST" style="max-height: ${robustLogoHeight}; max-width: ${robustLogoWidth}; object-fit: contain; display: block;" />`;
        }
      } else {
        headerBrandHtml = `<img src="${logoUrl}" alt="ROBUST" style="max-height: ${robustLogoHeight}; max-width: ${robustLogoWidth}; object-fit: contain; display: block; mix-blend-mode: screen;" />`;
      }
    }
  }

  return { headerBrandHtml, logoUrl };
}
