import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware.js';
import { validateSchema, uploadImageSchema } from '../middlewares/validation.js';
import { supabaseDb } from '../lib/supabase.js';
import { dataService } from '../services/dataService.js';
import { logAuditEvent } from '../lib/auditLogger.js';
import { STORE_BLOCKS } from '../config/storeBlocks.js';

const router = Router();

/**
 * @route   POST /api/upload/imagen
 * @desc    Sube una imagen de producto o de marca a Supabase Storage y actualiza la base de datos.
 */
router.post('/upload/imagen', requireAuth, requireRoles(['gerente', 'subadmin', 'jefe_sector', 'coordinador', 'operador', 'admin', 'superadmin', 'operator', 'coordinator']), validateSchema(uploadImageSchema), async (req, res, next) => {
  const { tipo, id, fileBase64, nombre } = req.body;

  try {
    // 1. Limpiar base64 header si existe
    const base64Cleaned = fileBase64.replace(/^data:image\/\w+;base64,/, "");
    const fileBuffer = Buffer.from(base64Cleaned, 'base64');

    const cleanId = String(id || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
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

    // Invalida caché de PDF para que la nueva imagen/logo se dibuje en las fichas
    try {
      if (tipo === 'producto') {
        const cacheFiles = [`${id}_a4.pdf`, `${id}_fleje3.pdf`, `${id}_fleje2.pdf`];
        await supabaseDb.storage.from('fichas-pdf').remove(cacheFiles);
        console.log(`[Storage Upload] Caché de PDF invalidada para SKU ${id}`);
      } else if (tipo === 'marca') {
        // Al actualizar un logotipo de marca, vaciar la caché de PDFs para forzar regeneración con el nuevo logo
        const { data: cachedPdfs } = await supabaseDb.storage.from('fichas-pdf').list('', { limit: 100 });
        if (cachedPdfs && cachedPdfs.length > 0) {
          const filesToRemove = cachedPdfs.map(f => f.name);
          await supabaseDb.storage.from('fichas-pdf').remove(filesToRemove);
          console.log(`[Storage Upload] Vaciada caché de PDFs (${filesToRemove.length} archivos) al actualizar marca ${id}`);
        }
      }
    } catch (err) {
      console.warn(`[Storage Upload] Advertencia al invalidar caché de PDF:`, err.message);
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
 * @desc    Obtiene la lista de marcas registradas filtradas dinámicamente por bloque departamental
 */
router.get('/marcas', requireAuth, async (req, res, next) => {
  try {
    const { bloque_id } = req.query;
    const allMarcas = await dataService.getAllMarcas();

    if (!bloque_id) {
      return res.json(allMarcas || []);
    }

    const targetBlockId = parseInt(bloque_id, 10);
    const targetBlock = STORE_BLOCKS.find(b => b.id === targetBlockId);

    if (!targetBlock) {
      return res.json(allMarcas || []);
    }

    // Sectores del bloque seleccionado
    const allowedSectorCodes = targetBlock.sector_ids.map(id => String(id).padStart(2, '0'));

    // Filtrar marcas: si la marca tiene productos en el catálogo SAP de ese bloque
    // o está explícitamente registrada para ese bloque
    const filteredMarcas = [];

    for (const marca of allMarcas) {
      const cleanSlug = marca.slug.toLowerCase().trim();
      const cleanNombre = marca.nombre.toLowerCase().trim();

      // Consultar si existen productos en el catálogo para esta marca
      const { data: prods } = await supabaseDb
        .from('productos')
        .select('grupo_articulos')
        .or(`descripcion.ilike.%${cleanNombre}%,descripcion.ilike.%${cleanSlug}%`)
        .limit(5);

      if (prods && prods.length > 0) {
        // Verificar si algún producto de la marca coincide con los sectores del bloque
        const matchesBlock = prods.some(p => {
          if (!p.grupo_articulos) return false;
          const secPrefix = p.grupo_articulos.substring(0, 2);
          return targetBlock.sector_ids.includes(parseInt(secPrefix, 10)) || targetBlock.sector_ids.includes(Number(secPrefix));
        });

        if (matchesBlock) {
          filteredMarcas.push(marca);
          continue;
        }
      }

      // Si no tiene productos vinculados aún pero es del bloque 1 por defecto histórico
      if (targetBlockId === 1 && ['bremen', 'stanley', 'blackdecker', 'robust', 'einhell', 'daewoo'].includes(cleanSlug)) {
        filteredMarcas.push(marca);
      }
    }

    return res.json(filteredMarcas);
  } catch (err) {
    console.error('[Marcas] Error al filtrar marcas por bloque:', err.message);
    const fallback = await dataService.getAllMarcas();
    return res.json(fallback || []);
  }
});

/**
 * @route   POST /api/marcas
 * @desc    Crea o edita una marca en la base de datos asociada a un sector/bloque
 */
router.post('/marcas', requireAuth, requireRoles(['gerente', 'subadmin', 'jefe_sector', 'coordinador', 'admin', 'superadmin']), async (req, res, next) => {
  const { slug, nombre, logo_url, sector_id, bloque_id } = req.body;
  if (!slug || !nombre || !logo_url) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios: slug, nombre, logo_url' });
  }

  try {
    const cleanSlug = slug.toLowerCase().trim();
    const cleanNombre = nombre.toUpperCase().trim();
    const targetSector = sector_id ? parseInt(sector_id, 10) : 45;
    const targetBlock = bloque_id ? parseInt(bloque_id, 10) : 1;

    const { data, error } = await supabaseDb
      .from('marcas')
      .upsert({
        slug: cleanSlug,
        nombre: cleanNombre,
        logo_url,
        updated_at: new Date().toISOString()
      }, { onConflict: 'slug' })
      .select()
      .maybeSingle();

    if (error) {
      await dataService.upsertMarca(cleanSlug, cleanNombre, logo_url);
    }
    
    logAuditEvent(req, {
      accion: 'BRAND_UPSERTED',
      entidad: 'MARCA',
      sku: cleanSlug,
      valores_nuevos: { nombre: cleanNombre, logo_url, sector_id: targetSector, bloque_id: targetBlock }
    });

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   DELETE /api/marcas/:slug
 * @desc    Elimina una marca por su slug.
 */
router.delete('/marcas/:slug', requireAuth, requireRoles(['admin', 'coordinator']), async (req, res, next) => {
  const { slug } = req.params;
  if (!slug) {
    return res.status(400).json({ error: 'Falta el parámetro slug' });
  }

  try {
    await dataService.deleteMarca(slug);

    logAuditEvent(req, {
      accion: 'BRAND_DELETED',
      entidad: 'MARCA',
      sku: slug.toLowerCase(),
      valores_nuevos: {}
    });

    return res.json({ success: true, message: `Marca "${slug}" eliminada correctamente.` });
  } catch (err) {
    next(err);
  }
});

export default router;
