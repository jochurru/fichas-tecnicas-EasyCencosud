import { Router } from 'express';
import { dataService } from '../services/dataService.js';
import { extractSpecifications } from '../lib/geminiExtractor.js';
import { fetchEasyProductImage } from '../lib/easyFetcher.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

/**
 * @route   GET /api/producto/:identificador
 * @desc    Busca un producto por SKU o código EAN.
 *          Si el producto existe pero no tiene ficha técnica, crea un borrador_ia inicial.
 */
router.get('/producto/:identificador', requireAuth, async (req, res, next) => {
  const { identificador } = req.params;
  const cleanedId = identificador.trim();

  try {
    let sku = cleanedId;

    // 1. Intentar resolver si el identificador es un código EAN
    const skuResolved = await dataService.resolveSkuFromEan(cleanedId);
    if (skuResolved) {
      sku = skuResolved;
      console.log(`EAN ${cleanedId} resuelto a SKU ${sku}`);
    }

    // 2. Obtener la información del producto maestro
    const producto = await dataService.getProductoBySku(sku);
    if (!producto) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: `No se encontró ningún producto con SKU o EAN: ${cleanedId}`
      });
    }

    // 3. Obtener o inicializar la ficha técnica dinámica
    let ficha = null;
    let origen = 'base_datos';

    const existingFicha = await dataService.getFichaBySku(producto.sku);

    const hasExtractionError = existingFicha && 
      (existingFicha.especificaciones_json?.Error || 
       !existingFicha.especificaciones_json?.especificaciones || 
       existingFicha.especificaciones_json?.especificaciones.length === 0);

    if (existingFicha && !hasExtractionError) {
      ficha = existingFicha;
    } else {
      // Si no existe o tiene errores de extracción, gatillar en paralelo el extractor IA con Gemini y la búsqueda de foto en Easy
      console.log(`[Pipeline Trigger] SKU ${producto.sku} requiere extracción. Iniciando extracción paralela (Gemini + Easy Scraper)...`);
      
      let especificacionesJson = {};
      let fotoUrl = existingFicha?.foto_url || null; // Preservar foto anterior si ya existía

      const [extResult, imageResult] = await Promise.allSettled([
        extractSpecifications(
          producto.descripcion,
          producto.proveedor,
          producto.grupo_articulos
        ),
        // Solo buscar foto si no tenemos una ya guardada
        fotoUrl ? Promise.resolve(fotoUrl) : fetchEasyProductImage(producto.sku)
      ]);

      // 1. Procesar resultado de Gemini
      if (extResult.status === 'fulfilled') {
        const val = extResult.value;
        especificacionesJson = {
          marca: val.marca,
          tipo_herramienta: val.tipo_herramienta,
          especificaciones: val.especificaciones,
          sugerencia_busqueda_imagen: val.sugerencia_busqueda_imagen
        };
        origen = 'creado_por_ia';
      } else {
        console.error('Error en la extracción de Gemini:', extResult.reason.message);
        especificacionesJson = {
          "Mensaje": "Error al extraer especificaciones automáticamente.",
          "Error": extResult.reason.message,
          "especificaciones": []
        };
      }

      // 2. Procesar resultado de foto de Easy
      if (!fotoUrl) {
        if (imageResult.status === 'fulfilled' && imageResult.value) {
          fotoUrl = imageResult.value;
          console.log(`[Pipeline] Foto oficial encontrada en Easy: ${fotoUrl}`);
        } else {
          if (imageResult.status === 'rejected') {
            console.error('Error al consultar foto oficial en Easy:', imageResult.reason.message);
          } else {
            console.log('[Pipeline] El producto no cuenta con foto en Easy.com.ar.');
          }
        }
      }

      // 3. Persistir borrador_ia en base de datos usando la abstracción
      try {
        ficha = await dataService.saveFichaBorrador(producto.sku, especificacionesJson, fotoUrl);
      } catch (insertError) {
        console.error('Error al guardar el borrador de la ficha técnica:', insertError);
      }
    }

    // Obtener los códigos EAN asociados al producto
    const eans = await dataService.getEansBySku(producto.sku);

    // Retornar el contrato acordado
    return res.json({
      producto: {
        sku: producto.sku,
        descripcion: producto.descripcion,
        proveedor: producto.proveedor,
        grupo_compras: producto.grupo_compras,
        grupo_articulos: producto.grupo_articulos,
        eans
      },
      ficha_tecnica: ficha,
      origen
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/fichas/aprobar
 * @desc    Aprueba y consolida una ficha técnica editada por el usuario.
 */
router.post('/fichas/aprobar', requireAuth, async (req, res, next) => {
  const { sku, especificaciones_json, foto_url, template_preferido, aprobado_por, ean } = req.body;

  // Validación básica del contrato
  if (!sku) {
    return res.status(400).json({ error: 'El campo "sku" es obligatorio.' });
  }
  if (!aprobado_por) {
    return res.status(400).json({ error: 'El campo "aprobado_por" es obligatorio.' });
  }

  try {
    // Verificar que el producto realmente existe
    const producto = await dataService.getProductoBySku(sku);
    if (!producto) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: `No se puede aprobar una ficha para un SKU inexistente: ${sku}`
      });
    }

    // Guardar la ficha técnica aprobada a través de la abstracción
    const updatedFicha = await dataService.saveFichaAprobada({
      sku,
      especificaciones_json,
      foto_url,
      template_preferido,
      aprobado_por,
      ean
    });

    return res.json({
      message: 'Ficha técnica aprobada y consolidada exitosamente.',
      ficha_tecnica: updatedFicha
    });

  } catch (error) {
    console.error('Error al aprobar la ficha técnica:', error);
    return res.status(500).json({
      error: 'Error interno al aprobar la ficha técnica',
      message: error.message
    });
  }
});

export default router;
