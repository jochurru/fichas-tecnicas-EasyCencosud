import { Router } from 'express';
import { dataService } from '../services/dataService.js';
import { generatePdfFromFicha, generateBatchPdf } from '../lib/pdfGenerator.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { supabaseDb } from '../lib/supabase.js';
import { validateSchema, printGetParamsSchema, printGetQuerySchema, printPostSchema, printBatchPostSchema } from '../middlewares/validation.js';
import { logAuditEvent } from '../lib/auditLogger.js';

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
router.get(
  '/fichas/:sku/pdf', 
  requireAuth, 
  validateSchema(printGetParamsSchema, 'params'),
  validateSchema(printGetQuerySchema, 'query'),
  async (req, res, next) => {
    const { sku } = req.params;
    const { template, action } = req.query;
    const fileName = `${sku}_${template}.pdf`;

    // Registrar auditoría de inicio de impresión o vista previa
    const auditAction = action === 'preview' ? 'PREVIEW_REQUESTED' : 'PRINT_REQUESTED';
    logAuditEvent(req, {
      accion: auditAction,
      entidad: 'FICHA_TECNICA',
      sku,
      valores_nuevos: { template, source: 'GET' }
    });

    try {
      // 1. Intentar descargar desde la caché de Supabase Storage
      console.log(`[GET PDF] Buscando en caché: ${fileName}...`);
      const { data: fileBlob, error: downloadError } = await supabaseDb.storage
        .from('fichas-pdf')
        .download(fileName);

      if (!downloadError && fileBlob) {
        console.log(`[GET PDF] ✓ Caché HIT para SKU: ${sku} (${template})`);
        const arrayBuffer = await fileBlob.arrayBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        return res.send(Buffer.from(arrayBuffer));
      }

      // 2. Caché MISS: Generar PDF en caliente con Puppeteer
      console.log(`[GET PDF] ✗ Caché MISS. Generando formato ${template} para SKU: ${sku}...`);
      const pdfBuffer = await buildFichaPdf(sku, template);

      // Registrar auditoría de generación del PDF (Caché MISS)
      logAuditEvent(req, {
        accion: 'PDF_GENERATED',
        entidad: 'FICHA_TECNICA',
        sku,
        valores_nuevos: { template }
      });

      // 3. Guardar el PDF generado en la caché en segundo plano
      supabaseDb.storage
        .from('fichas-pdf')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        })
        .then(({ error }) => {
          if (error) console.error(`[GET PDF] Error al subir caché para ${fileName}:`, error.message);
          else console.log(`[GET PDF] Ficha ${fileName} guardada en caché.`);
        })
        .catch(err => console.error(`[GET PDF] Error de subida en segundo plano:`, err));

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.send(Buffer.from(pdfBuffer));

    } catch (error) {
      logAuditEvent(req, {
        accion: auditAction,
        entidad: 'FICHA_TECNICA',
        sku,
        valores_nuevos: { error: error.message },
        resultado: 'FAILURE'
      });

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
  }
);

/**
 * @route   POST /api/fichas/imprimir
 * @desc    Genera y devuelve la ficha técnica en PDF a partir del SKU y template seleccionado.
 */
router.post('/fichas/imprimir', requireAuth, validateSchema(printPostSchema), async (req, res, next) => {
  const { sku, template, action } = req.body;
  const selectedTemplate = template || 'fleje3';
  const fileName = `${sku}_${selectedTemplate}.pdf`;

  // Registrar auditoría de inicio de impresión o vista previa
  const auditAction = action === 'preview' ? 'PREVIEW_REQUESTED' : 'PRINT_REQUESTED';
  logAuditEvent(req, {
    accion: auditAction,
    entidad: 'FICHA_TECNICA',
    sku,
    valores_nuevos: { template: selectedTemplate, source: 'POST' }
  });

  try {
    // 1. Intentar descargar desde la caché de Supabase Storage
    console.log(`[POST PDF] Buscando en caché: ${fileName}...`);
    const { data: fileBlob, error: downloadError } = await supabaseDb.storage
      .from('fichas-pdf')
      .download(fileName);

    if (!downloadError && fileBlob) {
      console.log(`[POST PDF] ✓ Caché HIT para SKU: ${sku} (${selectedTemplate})`);
      const arrayBuffer = await fileBlob.arrayBuffer();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.send(Buffer.from(arrayBuffer));
    }

    // 2. Caché MISS: Generar PDF con Puppeteer
    console.log(`[POST PDF] ✗ Caché MISS. Generando formato ${selectedTemplate} para SKU: ${sku}...`);
    const pdfBuffer = await buildFichaPdf(sku, selectedTemplate);

    // Registrar auditoría de generación del PDF (Caché MISS)
    logAuditEvent(req, {
      accion: 'PDF_GENERATED',
      entidad: 'FICHA_TECNICA',
      sku,
      valores_nuevos: { template: selectedTemplate }
    });

    // 3. Guardar el PDF en la caché de Supabase en segundo plano
    supabaseDb.storage
      .from('fichas-pdf')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })
      .then(({ error }) => {
        if (error) console.error(`[POST PDF] Error al subir caché para ${fileName}:`, error.message);
        else console.log(`[POST PDF] Ficha ${fileName} guardada en caché.`);
      })
      .catch(err => console.error(`[POST PDF] Error de subida en segundo plano:`, err));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    logAuditEvent(req, {
      accion: auditAction,
      entidad: 'FICHA_TECNICA',
      sku,
      valores_nuevos: { error: error.message },
      resultado: 'FAILURE'
    });

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

/**
 * @route   POST /api/fichas/imprimir-lote
 * @desc    Genera un archivo PDF compilado en lote a partir de una lista de SKUs, plantillas y copias.
 */
router.post(
  '/fichas/imprimir-lote',
  requireAuth,
  validateSchema(printBatchPostSchema),
  async (req, res, next) => {
    const { items } = req.body;
    
    // Registrar auditoría de inicio de impresión por lote (PRINT_REQUESTED)
    logAuditEvent(req, {
      accion: 'PRINT_REQUESTED',
      entidad: 'FICHA_TECNICA',
      sku: items[0]?.sku || 'LOTE',
      valores_nuevos: {
        total_items: items.length,
        total_cant: items.reduce((acc, curr) => acc + curr.cantidad, 0),
        items: items.map(i => ({ sku: i.sku, qty: i.cantidad, template: i.template }))
      }
    });

    try {
      // Generar el lote usando nuestra nueva función de compilación A4
      const pdfBuffer = await generateBatchPdf(items, dataService);

      const now = new Date();
      const YYYY = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const DD = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${YYYY}-${MM}-${DD}_${hh}-${mm}-${ss}`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="lote_impresion_${timestamp}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer, 'binary');
    } catch (error) {
      logAuditEvent(req, {
        accion: 'PRINT_REQUESTED',
        entidad: 'FICHA_TECNICA',
        sku: 'LOTE',
        valores_nuevos: { error: error.message },
        resultado: 'FAILURE'
      });

      console.error(`[BATCH PDF] Error al generar PDF por lote:`, error);
      next(error);
    }
  }
);

export default router;
