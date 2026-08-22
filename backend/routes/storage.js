import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { supabaseDb } from '../lib/supabase.js';
import { dataService } from '../services/dataService.js';
import { logAuditEvent } from '../lib/auditLogger.js';

const router = Router();

/**
 * @route   POST /api/upload/imagen
 * @desc    Sube una imagen de producto o de marca a Supabase Storage y actualiza la base de datos.
 */
router.post('/upload/imagen', requireAuth, async (req, res, next) => {
  const { tipo, id, fileBase64, nombre } = req.body;

  if (!tipo || !id || !fileBase64) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios: tipo, id, fileBase64' });
  }

  if (tipo !== 'producto' && tipo !== 'marca') {
    return res.status(400).json({ error: 'Tipo de imagen inválido. Debe ser "producto" o "marca"' });
  }

  try {
    // 1. Limpiar base64 header si existe
    const base64Cleaned = fileBase64.replace(/^data:image\/\w+;base64,/, "");
    const fileBuffer = Buffer.from(base64Cleaned, 'base64');

    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    const folder = tipo === 'producto' ? 'productos' : 'marcas';
    const filePath = `${folder}/${cleanId}.webp`;

    console.log(`[Storage Upload] Subiendo archivo a Supabase Storage: ${filePath} (${fileBuffer.length} bytes)...`);

    // 2. Subir a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseDb.storage
      .from('imagenes-catalogo')
      .upload(filePath, fileBuffer, {
        contentType: 'image/webp',
        upsert: true
      });

    if (uploadError) {
      console.error('[Storage Upload] Error de subida a Supabase:', uploadError);
      return res.status(500).json({ error: 'Error al subir la imagen a Supabase Storage', message: uploadError.message });
    }

    // 3. Obtener URL pública permanente
    const { data: { publicUrl } } = supabaseDb.storage
      .from('imagenes-catalogo')
      .getPublicUrl(filePath);

    console.log(`[Storage Upload] Imagen subida con éxito. URL: ${publicUrl}`);

    // 4. Actualizar Base de Datos según el tipo
    if (tipo === 'producto') {
      const sku = id.trim();
      const { error: dbError } = await supabaseDb
        .from('fichas_tecnicas')
        .update({ 
          foto_url: publicUrl,
          updated_at: new Date()
        })
        .eq('sku', sku);

      if (dbError) {
        console.error('[Storage Upload] Error al actualizar foto_url en fichas_tecnicas:', dbError);
        return res.status(500).json({ error: 'Error al asociar la foto al SKU del producto', message: dbError.message });
      }

      // Obtener ficha actual para crear snapshot histórico
      const existingFicha = await dataService.getFichaBySku(sku);
      if (existingFicha) {
        const { data: lastHist } = await supabaseDb
          .from('fichas_historial')
          .select('version')
          .eq('sku', sku)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const nextV = lastHist ? lastHist.version + 1 : 1;
        
        // Guardar snapshot histórico
        await supabaseDb
          .from('fichas_historial')
          .insert([{
            sku,
            version: nextV,
            especificaciones_json: existingFicha.especificaciones_json,
            foto_url: publicUrl,
            origen_cambio: 'USER_EDIT',
            modificado_por: req.user?.email || 'OPERADOR_LOCAL'
          }]);
      }

      logAuditEvent(req, {
        accion: 'PRODUCT_IMAGE_UPLOADED',
        entidad: 'FICHA_TECNICA',
        sku,
        valores_nuevos: { foto_url: publicUrl }
      });

    } else if (tipo === 'marca') {
      const slug = cleanId;
      const brandName = (nombre || id).toUpperCase().trim();
      
      await dataService.upsertMarca(slug, brandName, publicUrl);

      logAuditEvent(req, {
        accion: 'BRAND_LOGO_UPLOADED',
        entidad: 'MARCA',
        sku: slug,
        valores_nuevos: { brandName, logo_url: publicUrl }
      });
    }

    // Invalida caché de PDF para que la nueva imagen/logo se dibuje
    if (tipo === 'producto') {
      const cacheFile = `ficha_${id}_a4.pdf`;
      const cacheFileF3 = `ficha_${id}_fleje3.pdf`;
      const cacheFileF2 = `ficha_${id}_fleje2.pdf`;
      try {
        await supabaseDb.storage.from('fichas-pdf').remove([cacheFile, cacheFileF3, cacheFileF2]);
        console.log(`[Storage Upload] Caché de PDF invalidada para SKU ${id}`);
      } catch (err) {
        console.warn(`[Storage Upload] Error al invalidar caché de PDF para SKU ${id}:`, err.message);
      }
    }

    return res.json({
      success: true,
      url: publicUrl
    });

  } catch (err) {
    console.error('[Storage Upload] Excepción crítica durante subida:', err);
    return res.status(500).json({ error: 'Excepción crítica en el servidor al subir imagen', message: err.message });
  }
});

/**
 * @route   GET /api/marcas
 * @desc    Obtiene la lista completa de marcas registradas.
 */
router.get('/marcas', requireAuth, async (req, res, next) => {
  try {
    const marcas = await dataService.getAllMarcas();
    return res.json(marcas);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/marcas
 * @desc    Crea o edita una marca manualmente.
 */
router.post('/marcas', requireAuth, async (req, res, next) => {
  const { slug, nombre, logo_url } = req.body;
  if (!slug || !nombre || !logo_url) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios: slug, nombre, logo_url' });
  }

  try {
    const data = await dataService.upsertMarca(slug, nombre, logo_url);
    
    logAuditEvent(req, {
      accion: 'BRAND_UPSERTED',
      entidad: 'MARCA',
      sku: slug.toLowerCase(),
      valores_nuevos: { nombre, logo_url }
    });

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
