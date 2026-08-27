import { Router } from 'express';
import XLSX from 'xlsx';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware.js';
import { dataService } from '../services/dataService.js';
import { supabase, supabaseDb } from '../lib/supabase.js';
import { taskManager } from '../lib/taskManager.js';
import { validateSchema, loginSchema, excelUploadSchema } from '../middlewares/validation.js';
import { logAuditEvent } from '../lib/auditLogger.js';
import { calculateCompleteness, detectInconsistencies } from '../lib/dataQuality.js';

const router = Router();

/**
 * @route   POST /api/catalogos/importar
 * @desc    Procesa un reporte XLSX de SAP en base64, detecta nuevos productos y los carga a la base de datos.
 * @access  Privado (requiere privilegios de Administrador)
 */
router.post('/catalogos/importar', requireAuth, requireRoles(['admin']), validateSchema(excelUploadSchema), async (req, res, next) => {
  const { fileBase64 } = req.body;

  try {
    // 1. Decodificar Base64 a buffer
    console.log('[Catalogos] Decodificando archivo XLSX...');
    const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const buffer = Buffer.from(cleanBase64, 'base64');

    // 2. Leer el Excel usando SheetJS
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir la hoja a JSON
    const rows = XLSX.utils.sheet_to_json(worksheet);
    console.log(`[Catalogos] Filas totales en Excel: ${rows.length}`);

    // Registrar auditoría de inicio de importación SAP
    logAuditEvent(req, {
      accion: 'SAP_IMPORT_START',
      entidad: 'CATALOGO',
      valores_nuevos: { filasExcel: rows.length }
    });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío.' });
    }

    // 3. Detectar dinámicamente las columnas usando mapeo flexible (escaneando primeras 5 filas para soportar reportes SAP ZMA)
    let colMapping = {};
    let headerRowIndex = 0;

    for (let r = 0; r < Math.min(5, rows.length); r++) {
      const row = rows[r];
      let tempMapping = {};

      for (let [origKey, val] of Object.entries(row)) {
        const origKeyStr = String(origKey).trim().toLowerCase();
        const valStr = String(val).trim().toLowerCase();
        const combined = origKeyStr + ' ' + valStr;

        if (combined.includes('ean') || combined.includes('barra') || combined.includes('upc') || combined.includes('gtin')) {
          tempMapping[origKey] = 'ean';
        } else if (combined.includes('texto breve') || combined.includes('descrip') || combined.includes('denominac') || valStr === 'nombre' || valStr === 'producto') {
          tempMapping[origKey] = 'descripcion';
        } else if (combined.includes('material') || combined.includes('sku') || combined.includes('sap') || combined.includes('código') || combined.includes('codigo') || combined.includes('artículo')) {
          if (!tempMapping[origKey]) tempMapping[origKey] = 'sku';
        } else if (combined.includes('razón') || combined.includes('razon') || combined.includes('social') || combined.includes('proveed') || combined.includes('vendor')) {
          tempMapping[origKey] = 'proveedor';
        } else if (combined.includes('grupo art') || combined.includes('grupo_art') || combined.includes('rubro')) {
          tempMapping[origKey] = 'grupo_articulos';
        } else if (combined.includes('gcp') || combined.includes('grupo comp') || combined.includes('compras')) {
          tempMapping[origKey] = 'grupo_compras';
        }
      }

      if (Object.values(tempMapping).includes('sku')) {
        colMapping = tempMapping;
        headerRowIndex = r;
        break;
      }
    }

    // Validar columnas críticas mínimas (SKU y Descripción son indispensables)
    const requiredKeys = ['sku', 'descripcion'];
    const foundKeys = Object.values(colMapping);
    const missingKeys = requiredKeys.filter(k => !foundKeys.includes(k));

    if (missingKeys.length > 0) {
      return res.status(400).json({ 
        error: 'Estructura de Excel inválida', 
        message: `No se encontraron las columnas críticas: ${missingKeys.join(', ')}. Asegúrate de que el Excel tenga las columnas de Material/SKU y Descripción.`
      });
    }

    const startIdx = (rows[headerRowIndex] && String(rows[headerRowIndex][Object.keys(colMapping)[0]]).toLowerCase().includes('material')) ? headerRowIndex + 1 : headerRowIndex;
    const processRows = rows.slice(startIdx);
    const hasGCColumn = foundKeys.includes('grupo_compras');

    // 4. Filtrar y limpiar registros
    const cleanedProducts = [];
    const cleanedEans = [];

    // Obtener todos los SKUs existentes en base de datos para calcular el delta (nuevos)
    console.log('[Catalogos] Consultando catálogo de SKUs existentes...');
    const existingSkus = new Set(await dataService.getAllSkus());
    const newSkusImported = [];

    for (let row of processRows) {
      let rawSku = '';
      let rawDesc = '';
      let rawProv = 'DESCONOCIDO';
      let rawGC = '45'; // Valor por defecto si no existe columna en la planilla
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

      // Si la columna Grupo de compras existe en la planilla, filtrar estrictamente por GC 45
      if (hasGCColumn) {
        const isGC45 = rawGC === '45' || rawGC === '45.0' || rawGC === '045' || rawGC.startsWith('45');
        if (!isGC45) continue;
      }

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

    // 5. Registrar tarea asíncrona y responder inmediatamente (Status 202)
    const totalItems = uniqueProducts.length + uniqueEans.length;
    const taskId = await taskManager.createTask(totalItems);

    console.log(`[Catalogos] Creando tarea asíncrona ${taskId}. Total items a procesar: ${totalItems}`);

    // Lanzar el procesamiento en segundo plano
    setImmediate(async () => {
      try {
        const BATCH_SIZE = 100;
        let processedCount = 0;
        let nuevosCargados = 0;
        let eansCargados = 0;

        // Inyectar productos en lotes
        for (let i = 0; i < uniqueProducts.length; i += BATCH_SIZE) {
          const batch = uniqueProducts.slice(i, i + BATCH_SIZE);
          await dataService.upsertProductosBatch(batch);
          processedCount += batch.length;
          
          // Estimar los nuevos cargados de este lote
          const newInBatch = batch.filter(p => newSkusImported.includes(p.sku)).length;
          nuevosCargados += newInBatch;

          await taskManager.updateProgress(taskId, processedCount, {
            totalProcesados: processedCount,
            nuevosCargados,
            actualizados: processedCount - nuevosCargados,
            eansCargados
          });
        }

        // Inyectar EANs en lotes
        for (let i = 0; i < uniqueEans.length; i += BATCH_SIZE) {
          const batch = uniqueEans.slice(i, i + BATCH_SIZE);
          await dataService.upsertEansBatch(batch);
          processedCount += batch.length;
          eansCargados += batch.length;

          await taskManager.updateProgress(taskId, processedCount, {
            totalProcesados: processedCount - eansCargados,
            nuevosCargados,
            actualizados: (processedCount - eansCargados) - nuevosCargados,
            eansCargados
          });
        }

        // Invalidar el PDF en caché de Supabase Storage para todos los SKUs importados/actualizados
        const skusToClear = uniqueProducts.map(p => p.sku);
        const filesToClear = [];
        skusToClear.forEach(sku => {
          filesToClear.push(`${sku}_a4.pdf`, `${sku}_fleje3.pdf`, `${sku}_fleje2.pdf`);
        });

        if (filesToClear.length > 0) {
          const BATCH_CLEAR_SIZE = 100;
          for (let i = 0; i < filesToClear.length; i += BATCH_CLEAR_SIZE) {
            const batch = filesToClear.slice(i, i + BATCH_CLEAR_SIZE);
            await supabaseDb.storage.from('fichas-pdf').remove(batch);
          }
        }

        console.log(`[Catalogos] ✓ Tarea asíncrona ${taskId} finalizada con éxito.`);

        logAuditEvent(req, {
          accion: 'SAP_IMPORT_COMPLETE',
          entidad: 'CATALOGO',
          valores_nuevos: {
            totalProcesados: processedCount - eansCargados,
            nuevosCargados,
            eansCargados
          },
          resultado: 'SUCCESS'
        });

      } catch (bgError) {
        console.error(`[Catalogos] ❌ Error en segundo plano en tarea ${taskId}:`, bgError);
        await taskManager.failTask(taskId, bgError.message || 'Error durante el procesamiento del lote.');
        
        logAuditEvent(req, {
          accion: 'SAP_IMPORT_COMPLETE',
          entidad: 'CATALOGO',
          valores_nuevos: { error: bgError.message },
          resultado: 'FAILURE'
        });
      }
    });

    // Retornar la respuesta HTTP de aceptación de inmediato
    return res.status(202).json({
      success: true,
      taskId,
      message: 'El catálogo SAP ha sido recibido y se procesará en segundo plano.'
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
router.post('/catalogos/importar-eans', requireAuth, requireRoles(['admin']), validateSchema(excelUploadSchema), async (req, res, next) => {
  const { fileBase64 } = req.body;

  try {
    console.log('[Catalogos] Decodificando archivo XLSX de EANs...');
    const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const buffer = Buffer.from(cleanBase64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, cellText: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

    console.log(`[Catalogos] Filas totales en Excel de EANs: ${rows.length}`);

    // Registrar auditoría de inicio de importación EANs
    logAuditEvent(req, {
      accion: 'SAP_IMPORT_START',
      entidad: 'EAN_MAP',
      valores_nuevos: { filasExcel: rows.length }
    });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío.' });
    }

    // Detectar columnas usando mapeo flexible
    let firstRow = rows[0];
    let colMapping = {};

    for (let key of Object.keys(firstRow)) {
      const keyStr = String(key).trim();
      const keyLower = keyStr.toLowerCase();

      // PRIORIDAD 1: EAN / Barras / UPC / GTIN (debe evaluarse ANTES de 'código' para evitar falsos positivos con 'Código EAN')
      if (keyLower.includes('ean') || keyLower.includes('barra') || keyLower.includes('upc') || keyLower.includes('gtin')) {
        colMapping[key] = 'ean';
      } 
      // PRIORIDAD 2: SKU / Material / SAP / Código
      else if (keyLower === 'material' || keyLower === 'sku' || keyLower === 'sap' || keyLower.includes('sap') || keyLower.includes('art') || keyLower.includes('código') || keyLower.includes('codigo')) {
        colMapping[key] = 'sku';
      }
    }

    // Validar columnas requeridas y aplicar fallback posicional si es una planilla de 2 columnas
    let requiredKeys = ['sku', 'ean'];
    let foundKeys = Object.values(colMapping);
    let missingKeys = requiredKeys.filter(k => !foundKeys.includes(k));

    if (missingKeys.length > 0) {
      const keys = Object.keys(firstRow);
      if (keys.length >= 2) {
        console.log('[Catalogos] Aplicando detección posicional inteligente para EAN/SKU...');
        colMapping[keys[0]] = 'ean';
        colMapping[keys[1]] = 'sku';
        missingKeys = [];
      } else {
        return res.status(400).json({ 
          error: 'Estructura de Excel inválida', 
          message: `No se encontraron las columnas requeridas: ${missingKeys.join(', ')}. Verifica que la planilla contenga el SKU/Material y el código EAN.`
        });
      }
    }

    // Helper para formatear cadenas numéricas científicas
    const formatCleanString = (val) => {
      if (val === undefined || val === null) return '';
      let str = String(val).trim();
      if (/^\d+(\.\d+)?e\+\d+$/i.test(str)) {
        try {
          str = BigInt(Math.round(Number(val))).toString();
        } catch (e) {
          str = Number(val).toLocaleString('fullwide', { useGrouping: false });
        }
      }
      if (str.endsWith('.0')) {
        str = str.slice(0, -2);
      }
      return str;
    };

    // Filtrar y limpiar
    const cleanedEans = [];
    
    for (let row of rows) {
      let rawSku = '';
      let rawEan = '';

      for (let [origKey, mappedKey] of Object.entries(colMapping)) {
        const val = row[origKey];
        if (val !== undefined && val !== null) {
          if (mappedKey === 'sku') rawSku = formatCleanString(val);
          if (mappedKey === 'ean') rawEan = formatCleanString(val);
        }
      }

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

    logAuditEvent(req, {
      accion: 'SAP_IMPORT_COMPLETE',
      entidad: 'EAN_MAP',
      valores_nuevos: { totalProcesados: uniqueEans.length, eansCargados: uniqueEans.length },
      resultado: 'SUCCESS'
    });

    return res.json({
      success: true,
      estadisticas: {
        totalProcesados: uniqueEans.length,
        eansCargados: uniqueEans.length
      }
    });

  } catch (error) {
    console.error('[Catalogos] Error al importar EANs:', error);
    
    logAuditEvent(req, {
      accion: 'SAP_IMPORT_COMPLETE',
      entidad: 'EAN_MAP',
      valores_nuevos: { error: error.message },
      resultado: 'FAILURE'
    });

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
router.post('/auth/login', validateSchema(loginSchema), async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.session) {
      // Inyectar el email en req.user temporalmente para identificar al firmante del log de falla
      req.user = { email };
      logAuditEvent(req, {
        accion: 'LOGIN_FAILED',
        entidad: 'USUARIO',
        resultado: 'FAILURE'
      });

      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Credenciales de acceso inválidas o usuario no verificado.' 
      });
    }

    req.user = { email: data.user.email };
    logAuditEvent(req, {
      accion: 'LOGIN',
      entidad: 'USUARIO',
      resultado: 'SUCCESS'
    });

    return res.json({
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });

  } catch (err) {
    console.error('[Auth] Error al iniciar sesión:', err.message);
    req.user = { email };
    logAuditEvent(req, {
      accion: 'LOGIN_FAILED',
      entidad: 'USUARIO',
      valores_nuevos: { error: err.message },
      resultado: 'ERROR'
    });
    next(err);
  }
});

/**
 * @route   GET /api/catalogos/metricas
 * @desc    Obtiene métricas agregadas de los logs de auditoría para la gerencia.
 * @access  Privado (requiere privilegios de Administrador)
 */
router.get('/catalogos/metricas', requireAuth, requireRoles(['admin']), async (req, res, next) => {
  try {
    // 1. Obtener los últimos 2500 registros de auditoría para procesar métricas de forma segura
    const { data: logs, error } = await supabaseDb
      .from('audit_logs')
      .select('accion, sku, usuario_email, rol, timestamp')
      .order('timestamp', { ascending: false })
      .limit(2500);

    if (error) {
      throw error;
    }

    let busquedas = 0;
    let aprobaciones = 0;
    let impresiones = 0;
    let vistasPrevias = 0;
    let loginFailed = 0;

    const skuCounts = {};
    const operatorCounts = {};
    let draftsCreated = 0;
    let draftsApproved = 0;

    const safeLogs = logs || [];

    safeLogs.forEach(log => {
      // Contar acciones generales
      if (log.accion === 'PRODUCT_SEARCH') busquedas++;
      else if (log.accion === 'PRODUCT_APPROVE') aprobaciones++;
      else if (log.accion === 'PRINT_REQUESTED') impresiones++;
      else if (log.accion === 'PREVIEW_REQUESTED') vistasPrevias++;
      else if (log.accion === 'LOGIN_FAILED') loginFailed++;
      else if (log.accion === 'AI_DRAFT_CREATED') draftsCreated++;
      else if (log.accion === 'AI_DRAFT_APPROVED') {
        draftsApproved++;
        aprobaciones++;
      }

      // Contar SKUs
      if (log.sku) {
        const cleanSku = String(log.sku).trim();
        if (!skuCounts[cleanSku]) {
          skuCounts[cleanSku] = { sku: cleanSku, total: 0, impresiones: 0 };
        }
        skuCounts[cleanSku].total++;
        if (log.accion === 'PRINT_REQUESTED') {
          skuCounts[cleanSku].impresiones++;
        }
      }

      // Contar Operadores
      if (log.usuario_email && log.usuario_email !== 'SYSTEM_GUEST') {
        const email = log.usuario_email.trim();
        if (!operatorCounts[email]) {
          operatorCounts[email] = { email, rol: log.rol || 'OPERADOR', busquedas: 0, aprobaciones: 0, impresiones: 0 };
        }
        if (log.accion === 'PRODUCT_SEARCH') operatorCounts[email].busquedas++;
        else if (log.accion === 'PRODUCT_APPROVE') operatorCounts[email].aprobaciones++;
        else if (log.accion === 'PRINT_REQUESTED') operatorCounts[email].impresiones++;
      }
    });

    // Top 10 SKUs por demanda (búsquedas + impresiones)
    const topSkus = Object.values(skuCounts)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Listado de Operadores ordenados por nivel de uso/impresión
    const operadores = Object.values(operatorCounts)
      .sort((a, b) => b.impresiones - a.impresiones || b.busquedas - a.busquedas);

    // Como los eventos antiguos no emitían AI_DRAFT_APPROVED, calculamos cuántos drafts "legacy"
    // quedaron sin su evento correspondiente (draftsCreated totales - nuevos draftsApproved)
    // y asumimos que fueron aprobados (o lo limitamos al número de aprobaciones totales)
    const legacyDrafts = Math.max(0, draftsCreated - draftsApproved);
    const actualDraftsApproved = draftsApproved + Math.min(aprobaciones, legacyDrafts);
    const aiAcceptanceRate = draftsCreated > 0
      ? Math.round((actualDraftsApproved / draftsCreated) * 100)
      : 100;

    res.json({
      resumen: {
        busquedas,
        aprobaciones,
        impresiones,
        vistasPrevias,
        loginFailed,
        horasAhorradas: Number((impresiones * 14.5 / 60).toFixed(2))
      },
      topSkus,
      operadores,
      ia: {
        draftsCreated,
        draftsApproved: actualDraftsApproved,
        tasaAceptacion: Math.min(aiAcceptanceRate, 100)
      }
    });

  } catch (err) {
    console.error('[Metricas] Error al generar reportes consolidados:', err.message);
    res.status(500).json({
      error: 'Error al generar reportes',
      message: err.message
    });
  }
});

/**
 * @route   GET /api/admin/calidad-catalogo
 * @desc    Obtiene métricas agregadas de calidad y completitud del catálogo en tiempo real.
 * @access  Privado (requiere privilegios de Administrador)
 */
router.get('/admin/calidad-catalogo', requireAuth, requireRoles(['admin']), async (req, res, next) => {
  try {
    // 1. Obtener todos los productos y realizar left join con sus fichas_tecnicas
    const { data: records, error } = await supabaseDb
      .from('productos')
      .select('sku, descripcion, fichas_tecnicas(especificaciones_json, foto_url, estado)');

    if (error) {
      throw error;
    }

    // 2. Obtener todos los códigos EAN mapeados para asociarlos en memoria
    const { data: eanMappings, error: eanErr } = await supabaseDb
      .from('codigos_ean')
      .select('sku, ean');

    if (eanErr) {
      throw eanErr;
    }

    const eanMapBySku = {};
    (eanMappings || []).forEach(m => {
      if (m.sku) eanMapBySku[m.sku] = m.ean;
    });

    const safeRecords = records || [];

    let totalProductos = safeRecords.length;
    let fichasAprobadas = 0;
    let completas = 0; // >= 80%
    let incompletas = 0; // < 80%
    let sinImagen = 0;
    let sinEspecificaciones = 0;
    let totalInconsistencias = 0;
    
    // Contadores por estado
    const estadoCounts = {
      'SIN_FICHA': 0,
      'BORRADOR': 0,
      'GENERADA_POR_IA': 0,
      'PENDIENTE_VALIDACION': 0,
      'APROBADA': 0,
      'OBSERVADA': 0,
      'DESACTUALIZADA': 0,
      'VENCIDA': 0
    };

    const productosAtencion = [];

    // Recolectar todas las marcas registradas en Supabase con logos dinámicos
    let brandSlugsWithLogos = [];
    try {
      const { data: dbBrands } = await supabaseDb
        .from('marcas')
        .select('slug');
      if (dbBrands) {
        brandSlugsWithLogos = dbBrands.map(b => b.slug);
      }
    } catch (err) {
      console.error('[Quality API] Error al recuperar marcas para reporte de calidad:', err.message);
    }

    // Recolectar todos los EANs para chequear duplicados
    const allEans = [];
    safeRecords.forEach(r => {
      const ean = eanMapBySku[r.sku];
      if (ean) allEans.push(ean);
    });

    safeRecords.forEach(r => {
      const f = Array.isArray(r.fichas_tecnicas) ? r.fichas_tecnicas[0] : r.fichas_tecnicas;
      
      // Inject EAN into a temporary ficha object for consistency evaluation
      const tempFicha = f ? { ...f, ean: eanMapBySku[r.sku] } : null;

      const completeness = calculateCompleteness(r, tempFicha, brandSlugsWithLogos);
      
      // Filtrar el EAN actual de la lista global para chequear duplicidad
      const currentEan = eanMapBySku[r.sku];
      const otherEans = allEans.filter(e => e !== currentEan);
      const inconsistencies = detectInconsistencies(r, tempFicha, otherEans, brandSlugsWithLogos);
      
      const estado = f?.estado || 'SIN_FICHA';
      
      if (estadoCounts[estado] !== undefined) {
        estadoCounts[estado]++;
      } else {
        estadoCounts[estado] = 1;
      }

      if (estado === 'APROBADA') {
        fichasAprobadas++;
      }

      if (completeness >= 80) {
        completas++;
      } else {
        incompletas++;
      }

      if (!f?.foto_url || f.foto_url.trim().length === 0) {
        sinImagen++;
      }

      const specsList = f?.especificaciones_json?.specifications || f?.especificaciones_json?.especificaciones || [];
      if (specsList.length === 0) {
        sinEspecificaciones++;
      }

      totalInconsistencias += inconsistencies.length;

      // Un producto requiere atención si está incompleto, tiene inconsistencias o no tiene ficha aprobada
      if (completeness < 80 || inconsistencies.length > 0 || estado !== 'APROBADA') {
        productosAtencion.push({
          sku: r.sku,
          descripcion: r.descripcion,
          estado,
          completitud: completeness,
          inconsistenciasCount: inconsistencies.length,
          inconsistencias: inconsistencies
        });
      }
    });

    // Ordenar productos de atención por completitud ascendente (más críticos primero)
    productosAtencion.sort((a, b) => a.completitud - b.completitud);

    return res.json({
      resumen: {
        totalProductos,
        fichasAprobadas,
        fichasPendientes: totalProductos - fichasAprobadas,
        completas,
        incompletas,
        sinImagen,
        sinEspecificaciones,
        totalInconsistencias
      },
      estados: estadoCounts,
      requierenAtencion: productosAtencion.slice(0, 50) // Limitar a los 50 más críticos para rendimiento móvil
    });

  } catch (err) {
    console.error('[CalidadCatalogo] Error al generar reporte de calidad:', err.message);
    res.status(500).json({
      error: 'Error al generar reporte de calidad',
      message: err.message
    });
  }
});

/**
 * @route   GET /api/catalogos/tareas/:id
 * @desc    Obtiene el estado de progreso de una tarea de procesamiento de Excel en segundo plano.
 * @access  Privado (requiere privilegios de Administrador)
 */
router.get('/catalogos/tareas/:id', requireAuth, requireRoles(['admin']), async (req, res) => {
  const task = await taskManager.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }
  return res.json(task);
});

export default router;
