import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { extractSpecifications } from '../lib/geminiExtractor.js';
import { fetchEasyProductImage } from '../lib/easyFetcher.js';

const router = Router();

/**
 * @route   GET /api/producto/:identificador
 * @desc    Busca un producto por SKU o código EAN.
 *          Si el producto existe pero no tiene ficha técnica, crea un borrador_ia inicial.
 */
router.get('/producto/:identificador', async (req, res, next) => {
  const { identificador } = req.params;
  const cleanedId = identificador.trim();

  try {
    let sku = cleanedId;

    // 1. Intentar resolver si el identificador es un código EAN
    const { data: eanData, error: eanError } = await supabase
      .from('codigos_ean')
      .select('sku')
      .eq('ean', cleanedId)
      .maybeSingle();

    if (eanError) {
      console.error('Error al consultar codigos_ean:', eanError);
    }

    if (eanData) {
      sku = eanData.sku;
      console.log(`EAN ${cleanedId} resuelto a SKU ${sku}`);
    }

    // 2. Obtener la información del producto maestro
    const { data: producto, error: prodError } = await supabase
      .from('productos')
      .select('*')
      .eq('sku', sku)
      .maybeSingle();

    if (prodError) {
      console.error('Error al consultar productos:', prodError);
      return res.status(500).json({ error: 'Error interno al buscar el producto' });
    }

    if (!producto) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: `No se encontró ningún producto con SKU o EAN: ${cleanedId}`
      });
    }

    // 3. Obtener o inicializar la ficha técnica dinámica
    let ficha = null;
    let origen = 'base_datos';

    const { data: existingFicha, error: fichaError } = await supabase
      .from('fichas_tecnicas')
      .select('*')
      .eq('sku', producto.sku)
      .maybeSingle();

    if (fichaError) {
      console.error('Error al consultar fichas_tecnicas:', fichaError);
      return res.status(500).json({ error: 'Error interno al buscar la ficha técnica' });
    }

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

      // 3. Persistir borrador_ia en base de datos usando update o insert condicional
      let queryResult;
      if (existingFicha) {
        queryResult = await supabase
          .from('fichas_tecnicas')
          .update({
            especificaciones_json: especificacionesJson,
            foto_url: fotoUrl,
            estado: 'borrador_ia',
            template_preferido: 1
          })
          .eq('sku', producto.sku)
          .select()
          .single();
      } else {
        queryResult = await supabase
          .from('fichas_tecnicas')
          .insert({
            sku: producto.sku,
            especificaciones_json: especificacionesJson,
            foto_url: fotoUrl,
            estado: 'borrador_ia',
            template_preferido: 1
          })
          .select()
          .single();
      }

      const { data: newFicha, error: insertError } = queryResult;

      if (insertError) {
        console.error('Error al guardar la ficha técnica en base de datos:', insertError);
      } else {
        ficha = newFicha;
      }
    }

    // Retornar el contrato acordado
    return res.json({
      producto: {
        sku: producto.sku,
        descripcion: producto.descripcion,
        proveedor: producto.proveedor,
        grupo_compras: producto.grupo_compras,
        grupo_articulos: producto.grupo_articulos
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
router.post('/fichas/aprobar', async (req, res, next) => {
  const { sku, especificaciones_json, foto_url, template_preferido, aprobado_por } = req.body;

  // Validación básica del contrato
  if (!sku) {
    return res.status(400).json({ error: 'El campo "sku" es obligatorio.' });
  }
  if (!aprobado_por) {
    return res.status(400).json({ error: 'El campo "aprobado_por" es obligatorio.' });
  }

  try {
    // Verificar que el producto realmente existe
    const { data: producto, error: prodCheckError } = await supabase
      .from('productos')
      .select('sku')
      .eq('sku', sku)
      .maybeSingle();

    if (prodCheckError || !producto) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: `No se puede aprobar una ficha para un SKU inexistente: ${sku}`
      });
    }

    // Verificar si la ficha ya existe
    const { data: existingFicha, error: checkFichaError } = await supabase
      .from('fichas_tecnicas')
      .select('sku')
      .eq('sku', sku)
      .maybeSingle();

    let queryResult;
    if (existingFicha) {
      // Actualizar
      queryResult = await supabase
        .from('fichas_tecnicas')
        .update({
          foto_url: foto_url || null,
          especificaciones_json: especificaciones_json || {},
          estado: 'aprobado',
          template_preferido: template_preferido || 1,
          aprobado_por,
          aprobado_at: new Date().toISOString()
        })
        .eq('sku', sku)
        .select()
        .single();
    } else {
      // Insertar
      queryResult = await supabase
        .from('fichas_tecnicas')
        .insert({
          sku,
          foto_url: foto_url || null,
          especificaciones_json: especificaciones_json || {},
          estado: 'aprobado',
          template_preferido: template_preferido || 1,
          aprobado_por,
          aprobado_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    const { data: updatedFicha, error: updateError } = queryResult;

    if (updateError) {
      console.error('Error al aprobar la ficha técnica:', updateError);
      return res.status(500).json({
        error: 'Error interno al aprobar la ficha técnica',
        message: updateError.message
      });
    }

    return res.json({
      message: 'Ficha técnica aprobada y consolidada exitosamente.',
      ficha_tecnica: updatedFicha
    });

  } catch (error) {
    next(error);
  }
});

export default router;
