import { supabaseDb as supabase } from '../../lib/supabase.js';

/**
 * Proveedor de Datos para Supabase.
 * Implementa la interfaz requerida por el DataService.
 */
export class SupabaseProvider {
  /**
   * Ejecuta una consulta a Supabase aplicando reintentos automáticos ante fallas transitorias de red o timeout.
   */
  async _queryWithRetry(queryFn, label = 'query') {
    let lastError = null;
    const maxRetries = 3;
    const backoff = 500; // ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await queryFn();
        
        if (error) {
          const errorMsg = error.message || '';
          const isTransient = errorMsg.toLowerCase().includes('fetch') || 
                              errorMsg.toLowerCase().includes('timeout') || 
                              errorMsg.toLowerCase().includes('connection') || 
                              errorMsg.toLowerCase().includes('socket') ||
                              error.status === 502 || 
                              error.status === 503 || 
                              error.status === 504;

          if (isTransient && attempt < maxRetries) {
            console.warn(`[SupabaseProvider] Error transitorio en ${label} (intento ${attempt}/${maxRetries}): ${errorMsg}. Reintentando en ${backoff * attempt}ms...`);
            await new Promise(r => setTimeout(r, backoff * attempt));
            continue;
          }
          throw error;
        }
        return data;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const errStr = err.message || String(err);
          console.warn(`[SupabaseProvider] Excepción en ${label} (intento ${attempt}/${maxRetries}): ${errStr}. Reintentando en ${backoff * attempt}ms...`);
          await new Promise(r => setTimeout(r, backoff * attempt));
        }
      }
    }
    throw lastError;
  }

  /**
   * Resuelve el SKU correspondiente a un código EAN.
   * @param {string} ean - Código de barras EAN-13
   * @returns {Promise<string|null>} SKU asociado o null si no existe
   */
  async resolveSkuFromEan(ean) {
    const data = await this._queryWithRetry(() => 
      supabase
        .from('codigos_ean')
        .select('sku')
        .eq('ean', ean)
        .maybeSingle(),
      'resolveSkuFromEan'
    );
    return data ? data.sku : null;
  }

  /**
   * Obtiene la información del producto maestro desde la base de datos.
   * @param {string} sku - SKU del producto
   * @returns {Promise<Object|null>} Producto maestro o null
   */
  async getProductoBySku(sku) {
    return this._queryWithRetry(() => 
      supabase
        .from('productos')
        .select('*')
        .eq('sku', sku)
        .maybeSingle(),
      'getProductoBySku'
    );
  }

  /**
   * Obtiene la ficha técnica asociada a un SKU.
   * @param {string} sku - SKU del producto
   * @returns {Promise<Object|null>} Ficha técnica o null
   */
  async getFichaBySku(sku) {
    return this._queryWithRetry(() => 
      supabase
        .from('fichas_tecnicas')
        .select('*')
        .eq('sku', sku)
        .maybeSingle(),
      'getFichaBySku'
    );
  }

  /**
   * Crea o actualiza la ficha técnica en estado de "borrador_ia".
   * @param {string} sku - SKU del producto
   * @param {Object} especificacionesJson - JSON estructurado con las especificaciones
   * @param {string} fotoUrl - URL de la foto oficial
   * @returns {Promise<Object>} Ficha técnica persistida
   */
  async saveFichaBorrador(sku, especificacionesJson, fotoUrl) {
    const existing = await this.getFichaBySku(sku);
    let queryResult;

    const payload = {
      especificaciones_json: especificacionesJson,
      foto_url: fotoUrl,
      estado: 'GENERADA_POR_IA',
      template_preferido: existing?.template_preferido || 1
    };

    if (existing) {
      queryResult = await supabase
        .from('fichas_tecnicas')
        .update(payload)
        .eq('sku', sku)
        .select()
        .single();
    } else {
      queryResult = await supabase
        .from('fichas_tecnicas')
        .insert({
          sku,
          ...payload
        })
        .select()
        .single();
    }

    if (queryResult.error) {
      console.error(`[SupabaseProvider] Error en saveFichaBorrador:`, queryResult.error);
      throw queryResult.error;
    }
    return queryResult.data;
  }

  /**
   * Consolida y aprueba una ficha técnica editada por un operador.
   * Sincroniza la lista de códigos EAN asociados al SKU en la tabla codigos_ean.
   * @param {Object} data - Datos a guardar { sku, especificaciones_json, foto_url, template_preferido, aprobado_por, eans, estado }
   * @returns {Promise<Object>} Ficha técnica aprobada
   */
  async saveFichaAprobada(data) {
    const { sku, especificaciones_json, foto_url, template_preferido, aprobado_por, eans, estado } = data;
    const existing = await this.getFichaBySku(sku);
    let queryResult;

    const payload = {
      foto_url: foto_url || null,
      especificaciones_json: especificaciones_json || {},
      estado: estado || 'APROBADA',
      template_preferido: template_preferido || 1,
      aprobado_por,
      aprobado_at: new Date().toISOString()
    };

    if (existing) {
      queryResult = await supabase
        .from('fichas_tecnicas')
        .update(payload)
        .eq('sku', sku)
        .select()
        .single();
    } else {
      queryResult = await supabase
        .from('fichas_tecnicas')
        .insert({
          sku,
          ...payload
        })
        .select()
        .single();
    }

    if (queryResult.error) {
      console.error(`[SupabaseProvider] Error en saveFichaAprobada:`, queryResult.error);
      throw queryResult.error;
    }

    // Sincronizar EANs de forma dinámica (relación 1-a-N)
    try {
      // 1. Obtener EANs actuales de la DB para este SKU
      const { data: currentEansDb } = await supabase
        .from('codigos_ean')
        .select('ean')
        .eq('sku', sku);

      const dbEanList = (currentEansDb || []).map(item => item.ean);
      const newEanList = Array.isArray(eans) 
        ? eans.map(e => e.trim()).filter(Boolean) 
        : [];

      // 2. Determinar EANs que el usuario eliminó
      const eansToDelete = dbEanList.filter(e => !newEanList.includes(e));
      if (eansToDelete.length > 0) {
        const { error: delError } = await supabase
          .from('codigos_ean')
          .delete()
          .in('ean', eansToDelete);
        
        if (delError) {
          console.error(`[SupabaseProvider] Error al eliminar EANs obsoletos:`, delError);
        }
      }

      // 3. Upsertar todos los EANs activos en la nueva lista
      if (newEanList.length > 0) {
        const upsertRows = newEanList.map(ean => ({ ean, sku }));
        const { error: upsertError } = await supabase
          .from('codigos_ean')
          .upsert(upsertRows, { onConflict: 'ean' });
        
        if (upsertError) {
          console.error(`[SupabaseProvider] Error al upsertar nuevos EANs:`, upsertError);
        } else {
          console.log(`[SupabaseProvider] ${newEanList.length} códigos EAN sincronizados para SKU ${sku}`);
        }
      }
    } catch (eanSyncErr) {
      console.error(`[SupabaseProvider] Excepción al sincronizar EANs:`, eanSyncErr);
    }

    return queryResult.data;
  }

  /**
   * Obtiene todos los códigos EAN registrados para un SKU.
   * @param {string} sku - SKU del producto
   * @returns {Promise<string[]>} Lista de códigos EAN
   */
  async getEansBySku(sku) {
    const { data, error } = await supabase
      .from('codigos_ean')
      .select('ean')
      .eq('sku', sku);

    if (error) {
      console.error(`[SupabaseProvider] Error en getEansBySku:`, error);
      throw error;
    }
    return data ? data.map(r => r.ean) : [];
  }

  /**
   * Resuelve el primer código EAN asociado a un SKU.
   * @param {string} sku - SKU del producto
   * @returns {Promise<string>} Código EAN o "SIN EAN"
   */
  async getEanBySku(sku) {
    const { data, error } = await supabase
      .from('codigos_ean')
      .select('ean')
      .eq('sku', sku)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[SupabaseProvider] Error en getEanBySku:`, error);
      throw error;
    }
    return data ? data.ean : 'SIN EAN';
  }

  /**
   * Obtiene todos los SKUs registrados en la base de datos.
   * @returns {Promise<string[]>} Lista de SKUs
   */
  async getAllSkus() {
    const { data, error } = await supabase
      .from('productos')
      .select('sku');

    if (error) {
      console.error(`[SupabaseProvider] Error en getAllSkus:`, error);
      throw error;
    }
    return data ? data.map(p => p.sku) : [];
  }

  /**
   * Guarda o actualiza múltiples productos en lote (upsert).
   * @param {Array<Object>} productos - Lista de productos a persistir
   * @returns {Promise<void>}
   */
  async upsertProductosBatch(productos) {
    if (!productos || productos.length === 0) return;

    const { error } = await supabase
      .from('productos')
      .upsert(productos, { onConflict: 'sku' });

    if (error) {
      console.error(`[SupabaseProvider] Error en upsertProductosBatch:`, error);
      throw error;
    }
  }

  /**
   * Guarda o actualiza múltiples códigos EAN en lote (upsert).
   * @param {Array<Object>} eans - Lista de códigos EAN a persistir
   * @returns {Promise<void>}
   */
  async upsertEansBatch(eans) {
    if (!eans || eans.length === 0) return;

    const { error } = await supabase
      .from('codigos_ean')
      .upsert(eans, { onConflict: 'ean' });

    if (error) {
      console.error(`[SupabaseProvider] Error en upsertEansBatch:`, error);
      throw error;
    }
  }

  /**
   * Obtiene la configuración de una marca por su slug.
   * @param {string} slug - El slug identificador de la marca (ej: 'einhell')
   * @returns {Promise<Object|null>} Registro de marca o null
   */
  async getMarcaBySlug(slug) {
    const { data, error } = await supabase
      .from('marcas')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error(`[SupabaseProvider] Error en getMarcaBySlug para ${slug}:`, error);
      throw error;
    }
    return data;
  }

  /**
   * Obtiene la lista completa de marcas registradas.
   * @returns {Promise<Array>} Listado de marcas
   */
  async getAllMarcas() {
    const { data, error } = await supabase
      .from('marcas')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error(`[SupabaseProvider] Error en getAllMarcas:`, error);
      throw error;
    }
    return data || [];
  }

  /**
   * Crea o actualiza una marca (upsert).
   * @param {string} slug - El slug identificador
   * @param {string} nombre - El nombre visible de la marca
   * @param {string} logoUrl - URL del logotipo en storage
   * @returns {Promise<Object>} Registro creado/actualizado
   */
  async upsertMarca(slug, nombre, logoUrl) {
    const { data, error } = await supabase
      .from('marcas')
      .upsert({
        slug: slug.toLowerCase().trim(),
        nombre: nombre.toUpperCase().trim(),
        logo_url: logoUrl,
        updated_at: new Date()
      }, { onConflict: 'slug' })
      .select()
      .single();

    if (error) {
      console.error(`[SupabaseProvider] Error en upsertMarca para ${slug}:`, error);
      throw error;
    }
    return data;
  }
}
