import { supabase } from '../../lib/supabase.js';

/**
 * Proveedor de Datos para Supabase.
 * Implementa la interfaz requerida por el DataService.
 */
export class SupabaseProvider {
  /**
   * Resuelve el SKU correspondiente a un código EAN.
   * @param {string} ean - Código de barras EAN-13
   * @returns {Promise<string|null>} SKU asociado o null si no existe
   */
  async resolveSkuFromEan(ean) {
    const { data, error } = await supabase
      .from('codigos_ean')
      .select('sku')
      .eq('ean', ean)
      .maybeSingle();

    if (error) {
      console.error(`[SupabaseProvider] Error en resolveSkuFromEan:`, error);
      throw error;
    }
    return data ? data.sku : null;
  }

  /**
   * Obtiene la información del producto maestro desde la base de datos.
   * @param {string} sku - SKU del producto
   * @returns {Promise<Object|null>} Producto maestro o null
   */
  async getProductoBySku(sku) {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('sku', sku)
      .maybeSingle();

    if (error) {
      console.error(`[SupabaseProvider] Error en getProductoBySku:`, error);
      throw error;
    }
    return data;
  }

  /**
   * Obtiene la ficha técnica asociada a un SKU.
   * @param {string} sku - SKU del producto
   * @returns {Promise<Object|null>} Ficha técnica o null
   */
  async getFichaBySku(sku) {
    const { data, error } = await supabase
      .from('fichas_tecnicas')
      .select('*')
      .eq('sku', sku)
      .maybeSingle();

    if (error) {
      console.error(`[SupabaseProvider] Error en getFichaBySku:`, error);
      throw error;
    }
    return data;
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
      estado: 'borrador_ia',
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
   * Asocia opcionalmente un código EAN al SKU en la tabla codigos_ean.
   * @param {Object} data - Datos a guardar { sku, especificaciones_json, foto_url, template_preferido, aprobado_por, ean }
   * @returns {Promise<Object>} Ficha técnica aprobada
   */
  async saveFichaAprobada(data) {
    const { sku, especificaciones_json, foto_url, template_preferido, aprobado_por, ean } = data;
    const existing = await this.getFichaBySku(sku);
    let queryResult;

    const payload = {
      foto_url: foto_url || null,
      especificaciones_json: especificaciones_json || {},
      estado: 'aprobado',
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

    // Asociar EAN de forma dinámica si se provee
    if (ean && ean.trim()) {
      const { error: eanError } = await supabase
        .from('codigos_ean')
        .upsert({ ean: ean.trim(), sku }, { onConflict: 'ean' });

      if (eanError) {
        console.error(`[SupabaseProvider] Error al asociar EAN ${ean} a SKU ${sku}:`, eanError);
      } else {
        console.log(`[SupabaseProvider] EAN ${ean} asociado exitosamente a SKU ${sku}`);
      }
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
}
