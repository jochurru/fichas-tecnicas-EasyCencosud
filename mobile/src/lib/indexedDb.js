const DB_NAME = 'fichas-easy-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'productos';

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Guardamos todo el objeto productData retornado por el backend { producto, ficha_tecnica, origen }
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'producto.sku' });
        // Crear un índice secundario multi-entrada para buscar por EAN
        store.createIndex('eans', 'producto.eans', { unique: false, multiEntry: true });
      }
    };
  });
}

export async function saveProduct(productData) {
  if (!productData || !productData.producto || !productData.producto.sku) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(productData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[IndexedDB] Error al guardar producto:', err);
  }
}

export async function getProduct(identificador) {
  if (!identificador) return null;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      // 1. Buscar directamente por SKU
      const skuRequest = store.get(identificador);
      skuRequest.onsuccess = () => {
        if (skuRequest.result) {
          resolve(skuRequest.result);
        } else {
          // 2. Si no encuentra por SKU, buscar en el índice de EANs
          const index = store.index('eans');
          const eanRequest = index.get(identificador);
          eanRequest.onsuccess = () => resolve(eanRequest.result || null);
          eanRequest.onerror = () => reject(eanRequest.error);
        }
      };
      skuRequest.onerror = () => reject(skuRequest.error);
    });
  } catch (err) {
    console.error('[IndexedDB] Error al buscar producto:', err);
    return null;
  }
}
