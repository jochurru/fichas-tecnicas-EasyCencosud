import { Router } from 'express';
import XLSX from 'xlsx';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { dataService } from '../services/dataService.js';
import { supabase } from '../lib/supabase.js';

const router = Router();

/**
 * @route   POST /api/catalogos/importar
 * @desc    Procesa un reporte XLSX de SAP en base64, detecta nuevos productos y los carga a la base de datos.
 * @access  Privado (requiere JWT válido de Supabase)
 */
router.post('/catalogos/importar', requireAuth, async (req, res, next) => {
  const { fileBase64 } = req.body;

  if (!fileBase64) {
    return res.status(400).json({ error: 'El campo "fileBase64" es obligatorio.' });
  }

  try {
    // 1. Decodificar Base64 a buffer
    console.log('[Catalogos] Decodificando archivo XLSX...');
    const buffer = Buffer.from(fileBase64, 'base64');

    // 2. Leer el Excel usando SheetJS
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir la hoja a JSON
    const rows = XLSX.utils.sheet_to_json(worksheet);
    console.log(`[Catalogos] Filas totales en Excel: ${rows.length}`);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío.' });
    }

    // 3. Detectar dinámicamente las columnas usando mapeo flexible (robusto a caracteres especiales)
    let firstRow = rows[0];
    let colMapping = {};

    for (let key of Object.keys(firstRow)) {
      const keyStr = String(key).trim();
      const keyLower = keyStr.toLowerCase();

      if (keyLower === 'material') {
        colMapping[key] = 'sku';
      } else if (keyLower.includes('texto breve')) {
        colMapping[key] = 'descripcion';
      } else if (keyLower.includes('raz') && keyLower.includes('social')) {
        colMapping[key] = 'proveedor';
      } else if (keyLower.includes('grupo de compras')) {
        colMapping[key] = 'grupo_compras';
      } else if (keyLower.includes('grupo de art')) {
        colMapping[key] = 'grupo_articulos';
      } else if (keyLower.includes('ean') || keyLower.includes('codigo de barra') || keyLower.includes('código de barra') || keyLower.includes('upc')) {
        colMapping[key] = 'ean';
      }
    }

    // Validar columnas requeridas
    const requiredKeys = ['sku', 'descripcion', 'grupo_compras'];
    const foundKeys = Object.values(colMapping);
    const missingKeys = requiredKeys.filter(k => !foundKeys.includes(k));

    if (missingKeys.length > 0) {
      return res.status(400).json({ 
        error: 'Estructura de Excel inválida', 
        message: `No se encontraron las columnas críticas: ${missingKeys.join(', ')}. Asegúrate de subir el reporte de logística SAP correcto.`
      });
    }

    // 4. Filtrar y limpiar registros
    const cleanedProducts = [];
    const cleanedEans = [];

    // Obtener todos los SKUs existentes en base de datos para calcular el delta (nuevos)
    console.log('[Catalogos] Consultando catálogo de SKUs existentes...');
    const existingSkus = new Set(await dataService.getAllSkus());
    const newSkusImported = [];

    for (let row of rows) {
      let rawSku = '';
      let rawDesc = '';
      let rawProv = 'DESCONOCIDO';
      let rawGC = '';
      let rawGA = null;
      let rawEan = null;

      // Extraer campos basados en el mapeo flexible
      for (let [origKey, mappedKey] of Object.entries(colMapping)) {
        const val = row[origKey];
        if (val !== undefined && val !== null) {
          if (mappedKey === 'sku') rawSku = String(val).trim();
          if (mappedKey === 'descripcion') rawDesc = String(val).trim();
          if (mappedKey === 'proveedor') rawProv = String(val).trim();
          if (mappedKey === 'grupo_compras') rawGC = String(val).trim();
          if (mappedKey === 'grupo_articulos') rawGA = String(val).trim();
          if (mappedKey === 'ean') rawEan = String(val).trim();
        }
      }

      // Limpiar SKU y Grupo Artículos de posibles decimales introducidos por parseo numérico
      if (rawSku.endsWith('.0')) rawSku = rawSku.split('.')[0];
      if (rawGA && rawGA.endsWith('.0')) rawGA = rawGA.split('.')[0];

      if (!rawSku) continue;

      // Filtrar estrictamente por Grupo de compras === 45
      const isGC45 = rawGC === '45' || rawGC === '45.0' || rawGC === '045' || rawGC.startsWith('45');
      if (!isGC45) continue;

      cleanedProducts.push({
        sku: rawSku,
        descripcion: rawDesc,
        proveedor: rawProv || 'DESCONOCIDO',
        grupo_compras: '45',
        grupo_articulos: rawGA || null
      });

      if (rawEan) {
        cleanedEans.push({
          ean: rawEan,
          sku: rawSku
        });
      }

      // Verificar si es un ingreso nuevo en el catálogo
      if (!existingSkus.has(rawSku)) {
        newSkusImported.push(rawSku);
      }
    }

    // Quitar duplicados por SKU y EAN (para evitar conflictos de lotes)
    const uniqueProducts = Array.from(new Map(cleanedProducts.map(p => [p.sku, p])).values());
    const uniqueEans = Array.from(new Map(cleanedEans.map(e => [e.ean, e])).values());

    console.log(`[Catalogos] Limpios a importar: ${uniqueProducts.length} productos y ${uniqueEans.length} códigos EAN.`);

    // 5. Cargar en Supabase en lotes de 100 registros (para alto rendimiento)
    const BATCH_SIZE = 100;

    // Inyectar productos
    for (let i = 0; i < uniqueProducts.length; i += BATCH_SIZE) {
      const batch = uniqueProducts.slice(i, i + BATCH_SIZE);
      await dataService.upsertProductosBatch(batch);
    }

    // Inyectar EANs (si el Excel los provee)
    for (let i = 0; i < uniqueEans.length; i += BATCH_SIZE) {
      const batch = uniqueEans.slice(i, i + BATCH_SIZE);
      await dataService.upsertEansBatch(batch);
    }

    return res.json({
      success: true,
      estadisticas: {
        totalProcesados: uniqueProducts.length,
        nuevosCargados: newSkusImported.length,
        actualizados: uniqueProducts.length - newSkusImported.length,
        eansCargados: uniqueEans.length
      },
      nuevosSkus: newSkusImported.slice(0, 50) // Enviar primeros 50 SKUs nuevos para el reporte visual
    });

  } catch (error) {
    console.error('[Catalogos] Error crítico en importación:', error);
    return res.status(500).json({ 
      error: 'Error al procesar el catálogo SAP', 
      message: error.message 
    });
  }
});

/**
 * @route   POST /api/catalogos/importar-eans
 * @desc    Procesa un reporte XLSX de códigos de barra en base64 y los asocia a los SKUs en codigos_ean.
 * @access  Privado (requiere JWT válido de Supabase)
 */
router.post('/catalogos/importar-eans', requireAuth, async (req, res, next) => {
  const { fileBase64 } = req.body;

  if (!fileBase64) {
    return res.status(400).json({ error: 'El campo "fileBase64" es obligatorio.' });
  }

  try {
    console.log('[Catalogos] Decodificando archivo XLSX de EANs...');
    const buffer = Buffer.from(fileBase64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    console.log(`[Catalogos] Filas totales en Excel de EANs: ${rows.length}`);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío.' });
    }

    // Detectar columnas usando mapeo flexible
    let firstRow = rows[0];
    let colMapping = {};

    for (let key of Object.keys(firstRow)) {
      const keyStr = String(key).trim();
      const keyLower = keyStr.toLowerCase();

      if (keyLower === 'material' || keyLower === 'sku' || keyLower.includes('art') || keyLower.includes('código sap') || keyLower.includes('codigo sap')) {
        colMapping[key] = 'sku';
      } else if (keyLower.includes('ean') || keyLower.includes('codigo de barra') || keyLower.includes('código de barra') || keyLower.includes('upc') || keyLower.includes('barras')) {
        colMapping[key] = 'ean';
      }
    }

    // Validar columnas requeridas
    const requiredKeys = ['sku', 'ean'];
    const foundKeys = Object.values(colMapping);
    const missingKeys = requiredKeys.filter(k => !foundKeys.includes(k));

    if (missingKeys.length > 0) {
      return res.status(400).json({ 
        error: 'Estructura de Excel inválida', 
        message: `No se encontraron las columnas requeridas: ${missingKeys.join(', ')}. Verifica que la planilla contenga el SKU/Material y el código EAN.`
      });
    }

    // Filtrar y limpiar
    const cleanedEans = [];
    
    for (let row of rows) {
      let rawSku = '';
      let rawEan = '';

      for (let [origKey, mappedKey] of Object.entries(colMapping)) {
        const val = row[origKey];
        if (val !== undefined && val !== null) {
          if (mappedKey === 'sku') rawSku = String(val).trim();
          if (mappedKey === 'ean') rawEan = String(val).trim();
        }
      }

      // Limpiar decimales flotantes
      if (rawSku.endsWith('.0')) rawSku = rawSku.split('.')[0];
      if (rawEan.endsWith('.0')) rawEan = rawEan.split('.')[0];

      if (!rawSku || !rawEan) continue;

      cleanedEans.push({
        ean: rawEan,
        sku: rawSku
      });
    }

    // Quitar duplicados por EAN
    const uniqueEans = Array.from(new Map(cleanedEans.map(e => [e.ean, e])).values());

    console.log(`[Catalogos] Total registros EAN limpios a importar: ${uniqueEans.length}`);

    // Cargar en lotes de 100 en Supabase
    const BATCH_SIZE = 100;
    for (let i = 0; i < uniqueEans.length; i += BATCH_SIZE) {
      const batch = uniqueEans.slice(i, i + BATCH_SIZE);
      await dataService.upsertEansBatch(batch);
    }

    return res.json({
      success: true,
      estadisticas: {
        totalProcesados: uniqueEans.length,
        eansCargados: uniqueEans.length
      }
    });

  } catch (error) {
    console.error('[Catalogos] Error al importar EANs:', error);
    return res.status(500).json({ 
      error: 'Error al procesar el catálogo de EANs', 
      message: error.message 
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Inicia sesión con email y contraseña utilizando Supabase Auth y devuelve un token JWT.
 * @access  Público
 */
router.post('/auth/login', async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'El email y la contraseña son obligatorios.' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.session) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Credenciales de acceso inválidas o usuario no verificado.' 
      });
    }

    return res.json({
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });

  } catch (err) {
    console.error('[Auth] Error al iniciar sesión:', err.message);
    next(err);
  }
});

export default router;
