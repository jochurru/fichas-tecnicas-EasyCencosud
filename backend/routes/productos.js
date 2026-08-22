import { Router } from 'express';
import { dataService } from '../services/dataService.js';
import { extractSpecifications } from '../lib/geminiExtractor.js';
import { fetchEasyProductImage } from '../lib/easyFetcher.js';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware.js';
import { supabaseDb } from '../lib/supabase.js';
import { validateSchema, searchSchema, approveFichaSchema } from '../middlewares/validation.js';
import { logAuditEvent } from '../lib/auditLogger.js';

const router = Router();

const geminiUserRequests = new Map();

/**
 * @route   GET /api/producto/:identificador
 * @desc    Busca un producto por SKU o código EAN.
 *          Si el producto existe pero no tiene ficha técnica, crea un borrador_ia inicial.
 */
router.get('/producto/:identificador', requireAuth, validateSchema(searchSchema, 'params'), async (req, res, next) => {
  const { identificador } = req.params;
  const cleanedId = identificador.trim().replace(/[^a-zA-Z0-9-]/g, '');

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
      logAuditEvent(req, {
        accion: 'PRODUCT_SEARCH',
        entidad: 'PRODUCTO',
        sku: cleanedId,
        resultado: 'FAILURE'
      });

      return res.status(404).json({
        error: 'Producto no encontrado',
        message: `No se encontró ningún producto con SKU o EAN: ${cleanedId}`
      });
    }

    logAuditEvent(req, {
      accion: 'PRODUCT_SEARCH',
      entidad: 'PRODUCTO',
      sku: producto.sku,
      resultado: 'SUCCESS'
    });

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
      // Gemini Rate Limiting manual por usuario (evita falsos positivos en búsquedas estándar cached)
      const email = req.user.email;
      const now = Date.now();
      const windowMs = 15 * 60 * 1000; // 15 minutos
      const maxRequests = 30;

      let currentCount = 0;
      let dbSuccess = false;

      try {
        // Ejecutar el incremento de cuota atómico en Supabase vía RPC
        const { data, error } = await supabaseDb.rpc('increment_gemini_rate_limit', { p_email: email });
        
        if (!error && data && data.length > 0) {
          currentCount = data[0].count;
          dbSuccess = true;
        } else if (error) {
          console.warn('[RateLimit] Error llamando a RPC increment_gemini_rate_limit, usando fallback de memoria:', error.message);
        }
      } catch (err) {
        console.warn('[RateLimit] Excepción al ejecutar RPC, usando fallback de memoria:', err.message);
      }

      // Fallback a memoria local si Supabase falla o la tabla/función no está creada aún
      if (!dbSuccess) {
        let userRecord = geminiUserRequests.get(email);
        if (!userRecord || now > userRecord.resetTime) {
          userRecord = { count: 0, resetTime: now + windowMs };
        }
        userRecord.count += 1;
        geminiUserRequests.set(email, userRecord);
        currentCount = userRecord.count;
      }

      if (currentCount > maxRequests) {
        logAuditEvent(req, {
          accion: 'GEMINI_RATE_LIMIT_EXCEEDED',
          entidad: 'PRODUCTO',
          sku: producto.sku,
          valores_nuevos: { email },
          resultado: 'FAILURE'
        });
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Límite de solicitudes Gemini superado. Intente de nuevo más tarde.'
        });
      }

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

        // Registrar instantánea histórica del borrador IA (versión 1)
        const { data: lastHist } = await supabaseDb
          .from('fichas_historial')
          .select('version')
          .eq('sku', producto.sku)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const nextV = lastHist ? lastHist.version + 1 : 1;

        const { error: insertHistError } = await supabaseDb
          .from('fichas_historial')
          .insert([{
            sku: producto.sku,
            version: nextV,
            especificaciones_json: especificacionesJson,
            foto_url: fotoUrl,
            origen_cambio: 'IA_DRAFT',
            modificado_por: 'GEMINI_AI'
          }]);

        if (insertHistError) {
          console.error('[Productos] Error al registrar borrador en el historial:', insertHistError.message);
        }

        logAuditEvent(req, {
          accion: 'AI_DRAFT_CREATED',
          entidad: 'FICHA_TECNICA',
          sku: producto.sku,
          valores_nuevos: especificacionesJson
        });
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
router.post('/fichas/aprobar', requireAuth, requireRoles(['admin', 'coordinator']), validateSchema(approveFichaSchema), async (req, res, next) => {
  const { sku, especificaciones_json, foto_url, template_preferido, eans, estado } = req.body;
  const verfiedEmail = req.user.email;

  try {
    // 1. Obtener la ficha técnica actual antes de modificar (para auditoría)
    const previousFicha = await dataService.getFichaBySku(sku);

    // 2. Verificar que el producto realmente existe
    const producto = await dataService.getProductoBySku(sku);
    if (!producto) {
      logAuditEvent(req, {
        accion: 'PRODUCT_APPROVE',
        entidad: 'FICHA_TECNICA',
        sku,
        valores_nuevos: { error: 'Producto inexistente' },
        resultado: 'FAILURE'
      });

      return res.status(404).json({
        error: 'Producto no encontrado',
        message: `No se puede aprobar una ficha para un SKU inexistente: ${sku}`
      });
    }

    // 3. Guardar la ficha técnica aprobada a través de la abstracción
    const updatedFicha = await dataService.saveFichaAprobada({
      sku,
      especificaciones_json,
      foto_url,
      template_preferido,
      aprobado_por: verfiedEmail,
      eans,
      estado
    });

    // 4. Registrar instantánea histórica en la tabla fichas_historial
    const { data: lastHist } = await supabaseDb
      .from('fichas_historial')
      .select('version')
      .eq('sku', sku)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = lastHist ? lastHist.version + 1 : 1;

    const { error: insertHistError } = await supabaseDb
      .from('fichas_historial')
      .insert([{
        sku,
        version: nextVersion,
        especificaciones_json,
        foto_url,
        origen_cambio: req.user.role === 'admin' || req.user.role === 'coordinator'
          ? 'APROBACION_COORDINADOR'
          : 'EDICION_LOCAL',
        modificado_por: verfiedEmail
      }]);

    if (insertHistError) {
      console.error('[Productos] Error al registrar historial de versión:', insertHistError.message);
    }

    // 5. Invalidar caché de PDFs para este SKU en Supabase Storage (las 3 plantillas posibles)
    const cacheFiles = [`${sku}_a4.pdf`, `${sku}_fleje3.pdf`, `${sku}_fleje2.pdf`];
    supabaseDb.storage.from('fichas-pdf').remove(cacheFiles)
      .then(({ error }) => {
        if (error) console.error(`[PDF Storage] Error al invalidar caché para SKU ${sku}:`, error.message);
        else console.log(`[PDF Storage] Caché de PDF invalidada para SKU ${sku}.`);
      })
      .catch(err => console.error(`[PDF Storage] Error al limpiar caché de PDF:`, err));

    // 6. Registrar en el Log de Auditoría Inmutable
    logAuditEvent(req, {
      accion: 'PRODUCT_APPROVE',
      entidad: 'FICHA_TECNICA',
      sku,
      valores_anteriores: previousFicha ? previousFicha.especificaciones_json : null,
      valores_nuevos: especificaciones_json,
      resultado: 'SUCCESS'
    });

    console.log(`[AUDIT] Ficha técnica para SKU ${sku} APROBADA por el operador: ${aprobado_por}`);

    return res.json({
      message: 'Ficha técnica aprobada y consolidada exitosamente.',
      ficha_tecnica: updatedFicha
    });

  } catch (error) {
    console.error('Error al aprobar la ficha técnica:', error);
    
    logAuditEvent(req, {
      accion: 'PRODUCT_APPROVE',
      entidad: 'FICHA_TECNICA',
      sku,
      valores_nuevos: { error: error.message },
      resultado: 'FAILURE'
    });

    return res.status(500).json({
      error: 'Error interno al aprobar la ficha técnica',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/fichas/:sku/historial
 * @desc    Obtiene el historial de versiones de una ficha técnica por SKU.
 */
router.get('/fichas/:sku/historial', requireAuth, async (req, res, next) => {
  const { sku } = req.params;
  try {
    const { data: history, error } = await supabaseDb
      .from('fichas_historial')
      .select('id, sku, version, especificaciones_json, foto_url, origen_cambio, modificado_por, created_at')
      .eq('sku', sku)
      .order('version', { ascending: false });

    if (error) {
      throw error;
    }

    return res.json(history || []);
  } catch (err) {
    console.error('[Historial] Error al consultar versiones:', err.message);
    next(err);
  }
});

export default router;
