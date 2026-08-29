import { supabaseDb } from './supabase.js';

/**
 * Elimina un archivo de Supabase Storage a partir de su URL pública.
 * @param {string} publicUrl - URL pública del archivo en Supabase Storage.
 * @returns {Promise<boolean>} true si se eliminó correctamente.
 */
export async function deleteStorageFileByUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return false;

  try {
    // Verificar si la URL pertenece a nuestro bucket de Supabase Storage
    const bucketMarker = '/storage/v1/object/public/imagenes-catalogo/';
    if (!publicUrl.includes(bucketMarker)) {
      console.log(`[StorageHelper] La URL no corresponde a un archivo en Supabase Storage: ${publicUrl}`);
      return false;
    }

    const relativePath = publicUrl.substring(publicUrl.indexOf(bucketMarker) + bucketMarker.length);
    if (!relativePath) return false;

    console.log(`[StorageHelper] Eliminando archivo de Supabase Storage: ${relativePath}`);
    const { error } = await supabaseDb.storage
      .from('imagenes-catalogo')
      .remove([relativePath]);

    if (error) {
      console.error(`[StorageHelper] Error eliminando archivo ${relativePath}:`, error);
      return false;
    }

    console.log(`[StorageHelper] Archivo eliminado con éxito de Storage: ${relativePath}`);
    return true;
  } catch (err) {
    console.error(`[StorageHelper] Excepción al intentar eliminar archivo:`, err);
    return false;
  }
}
