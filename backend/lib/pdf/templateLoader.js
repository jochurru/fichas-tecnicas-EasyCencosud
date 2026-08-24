import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @fileoverview Cargador y resolutor de plantillas HTML para la generación de PDFs.
 * Determina si debe cargarse la plantilla especial de marca (ej: Robust) o estándar.
 */

/**
 * Carga el contenido de la plantilla HTML correspondiente según formato y marca.
 * 
 * @param {string} templateName - Identificador de plantilla ('fleje3', 'fleje2', 'a4', etc.)
 * @param {string} brandName - Nombre de la marca del producto
 * @returns {string} Contenido HTML crudo con placeholders {{placeholder}}
 * @throws {Error} Si el archivo de plantilla no existe en el disco
 */
export function loadTemplate(templateName = 'fleje3', brandName = '') {
  const brandLower = (brandName || '').toLowerCase().trim();
  const tmplLower = (templateName || '').toLowerCase().trim();
  const isRobust = brandLower.includes('robust') || tmplLower.includes('robust');

  let fileName = 'template_fleje_3.html';

  if (isRobust) {
    if (tmplLower.includes('a4')) {
      fileName = 'template_robust_a4.html';
    } else if (tmplLower.includes('fleje2') || tmplLower.includes('fleje_2')) {
      fileName = 'template_robust_fleje_2.html';
    } else {
      fileName = 'template_robust_fleje_3.html';
    }
  } else {
    if (tmplLower.includes('a4')) {
      fileName = 'template_a4.html';
    } else if (tmplLower.includes('fleje2') || tmplLower.includes('fleje_2')) {
      fileName = 'template_fleje_2.html';
    } else {
      fileName = 'template_fleje_3.html';
    }
  }

  const templatePath = path.join(__dirname, '../../templates', fileName);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`La plantilla no existe en la ruta: ${templatePath}`);
  }

  return fs.readFileSync(templatePath, 'utf8');
}
