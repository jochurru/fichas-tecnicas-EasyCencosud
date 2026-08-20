import { Router } from 'express';
import { dataService } from '../services/dataService.js';
import { generatePdfFromFicha } from '../lib/pdfGenerator.js';

const router = Router();

/**
 * Función auxiliar para recuperar datos a través de dataService y compilar el PDF.
 * 
 * @param {string} sku - El SKU del producto
 * @param {string} templateName - El nombre de la plantilla
 * @returns {Promise<Buffer>}
 */
async function buildFichaPdf(sku, templateName) {
  // 1. Obtener la información del producto maestro desde el servicio de datos
  const producto = await dataService.getProductoBySku(sku);
  if (!producto) {
    throw new Error('PRODUCT_NOT_FOUND');
  }

  // 2. Obtener la ficha técnica asociada desde el servicio de datos
  const ficha_tecnica = await dataService.getFichaBySku(sku);
  if (!ficha_tecnica) {
    throw new Error('FICHA_NOT_FOUND');
  }

  // 3. Obtener el primer EAN asociado al SKU
  const ean = await dataService.getEanBySku(sku);

  // 4. Generar el PDF usando el motor de Puppeteer
  return await generatePdfFromFicha({ producto, ficha_tecnica, ean }, templateName);
}

/**
 * @route   GET /api/fichas/:sku/pdf
 * @desc    Genera y devuelve la cartela de góndola en PDF para un SKU específico.
 *          Soporta el query parameter ?template=a4|fleje3|fleje2.
 */
router.get('/fichas/:sku/pdf', async (req, res, next) => {
  const { sku } = req.params;
  const template = req.query.template || 'fleje3';

  try {
    console.log(`[GET PDF] Generando formato ${template} para SKU: ${sku}...`);
    const pdfBuffer = await buildFichaPdf(sku, template);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ficha_${sku}_${template}.pdf"`);
    return res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    if (error.message === 'FICHA_NOT_FOUND') {
      return res.status(404).json({ 
        error: 'Ficha técnica no encontrada', 
        message: 'Debe consultar o inicializar la ficha técnica antes de poder imprimir.' 
      });
    }
    console.error(`[GET PDF] Error al generar PDF para el SKU ${sku}:`, error);
    next(error);
  }
});

/**
 * @route   POST /api/fichas/imprimir
 * @desc    Genera y devuelve la ficha técnica en PDF a partir del SKU y template seleccionado.
 */
router.post('/fichas/imprimir', async (req, res, next) => {
  const { sku, template } = req.body;

  if (!sku) {
    return res.status(400).json({ error: 'El campo "sku" es obligatorio.' });
  }

  const validTemplates = ['a4', 'fleje3', 'fleje2'];
  const selectedTemplate = template || 'fleje3';

  if (!validTemplates.includes(selectedTemplate)) {
    return res.status(400).json({ 
      error: 'Template no válido.', 
      message: `Los valores permitidos son: ${validTemplates.join(', ')}` 
    });
  }

  try {
    console.log(`[POST PDF] Generando formato ${selectedTemplate} para SKU: ${sku}...`);
    const pdfBuffer = await buildFichaPdf(sku, selectedTemplate);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ficha_${sku}_${selectedTemplate}.pdf"`);
    return res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    if (error.message === 'FICHA_NOT_FOUND') {
      return res.status(404).json({ 
        error: 'Ficha técnica no encontrada', 
        message: 'Debe consultar o inicializar la ficha técnica antes de poder imprimir.' 
      });
    }
    console.error(`[POST PDF] Error al generar PDF para el SKU ${sku}:`, error);
    next(error);
  }
});

export default router;
