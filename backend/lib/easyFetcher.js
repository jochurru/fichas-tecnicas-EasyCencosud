import dotenv from 'dotenv';

dotenv.config();

/**
 * Busca la foto oficial de un producto en Easy Cencosud utilizando el SKU.
 * 
 * @param {string} sku - Código SKU/Material del producto.
 * @returns {Promise<string|null>} URL de la imagen principal o null si no se encuentra.
 */
export async function fetchEasyProductImage(sku) {
  if (!sku) return null;
  const cleanedSku = sku.trim();

  // 1. Intentar con el endpoint de búsqueda exacto por SKU ID
  const skuUrl = `https://www.easy.com.ar/api/catalog_system/pub/products/search?fq=skuId:${cleanedSku}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  try {
    console.log(`[Easy Fetcher] Consultando API por SKU: ${cleanedSku}`);
    const response = await fetch(skuUrl, { headers });
    
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const image = data[0]?.items?.[0]?.images?.[0]?.imageUrl;
        if (image) {
          console.log(`[Easy Fetcher] Imagen encontrada en API por skuId: ${image}`);
          return image;
        }
      }
    }
  } catch (err) {
    console.error(`[Easy Fetcher] Error consultando por skuId:`, err.message);
  }

  // 2. Fallback: Intentar buscando por Product ID
  const productUrl = `https://www.easy.com.ar/api/catalog_system/pub/products/search?fq=productId:${cleanedSku}`;
  try {
    console.log(`[Easy Fetcher] Fallback: Consultando API por productId: ${cleanedSku}`);
    const response = await fetch(productUrl, { headers });
    
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const image = data[0]?.items?.[0]?.images?.[0]?.imageUrl;
        if (image) {
          console.log(`[Easy Fetcher] Imagen encontrada en API por productId: ${image}`);
          return image;
        }
      }
    }
  } catch (err) {
    console.error(`[Easy Fetcher] Error consultando por productId:`, err.message);
  }

  // 3. Fallback: Scrapear og:image desde la página web directa del producto
  const pageUrl = `https://www.easy.com.ar/${cleanedSku}?_q=${cleanedSku}&map=ft`;
  try {
    console.log(`[Easy Fetcher] Fallback: Scrapeando página HTML: ${pageUrl}`);
    const response = await fetch(pageUrl, { headers });
    
    if (response.ok) {
      const html = await response.text();
      // Expresión regular para og:image
      const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/) || 
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/);
      
      if (ogImgMatch && ogImgMatch[1]) {
        const image = ogImgMatch[1];
        console.log(`[Easy Fetcher] Imagen encontrada en og:image HTML: ${image}`);
        return image;
      }
    }
  } catch (err) {
    console.error(`[Easy Fetcher] Error al scrapear página HTML:`, err.message);
  }

  console.log(`[Easy Fetcher] No se pudo encontrar imagen para el SKU: ${cleanedSku}`);
  return null;
}
