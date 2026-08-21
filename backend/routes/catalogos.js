import { Router } from 'express';
import XLSX from 'xlsx';
import { requireAdmin } from '../middlewares/authMiddleware.js';
import { dataService } from '../services/dataService.js';
import { supabase, supabaseDb } from '../lib/supabase.js';
import { taskManager } from '../lib/taskManager.js';
import { validateSchema, loginSchema, excelUploadSchema } from '../middlewares/validation.js';
import { logAuditEvent } from '../lib/auditLogger.js';

const router = Router();

/**
 * @route   POST /api/catalogos/importar
 * @desc    Procesa un reporte XLSX de SAP en base64, detecta nuevos productos y los carga a la base de datos.
 * @access  Privado (requiere privilegios de Administrador)
 */
router.post('/catalogos/importar', requireAdmin, validateSchema(excelUploadSchema), async (req, res, next) => {
  const { fileBase64 } = req.body;

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

    // Registrar auditoría de inicio de importación SAP
    logAuditEvent(req, {
      accion: 'SAP_IMPORT_START',
      entidad: 'CATALOGO',
      valores_nuevos: { filasExcel: rows.length }
    });

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

    // 5. Registrar tarea asíncrona y responder inmediatamente (Status 202)
    const totalItems = uniqueProducts.length + uniqueEans.length;
    const taskId = taskManager.createTask(totalItems);

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

          taskManager.updateProgress(taskId, processedCount, {
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

          taskManager.updateProgress(taskId, processedCount, {
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
        taskManager.failTask(taskId, bgError.message || 'Error durante el procesamiento del lote.');
        
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
router.post('/catalogos/importar-eans', requireAdmin, validateSchema(excelUploadSchema), async (req, res, next) => {
  const { fileBase64 } = req.body;

  try {
    console.log('[Catalogos] Decodificando archivo XLSX de EANs...');
    const buffer = Buffer.from(fileBase64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

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
router.get('/catalogos/metricas', requireAdmin, async (req, res, next) => {
  try {
    // 1. Obtener todos los registros de auditoría
    const { data: logs, error } = await supabaseDb
      .from('audit_logs')
      .select('accion, sku, usuario_email, rol, timestamp')
      .order('timestamp', { ascending: false });

    if (error) {
      throw error;
    }

    let busquedas = 0;
    let aprobaciones = 0;
    let impresiones = 0;
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
      else if (log.accion === 'LOGIN_FAILED') loginFailed++;
      else if (log.accion === 'AI_DRAFT_CREATED') draftsCreated++;
      else if (log.accion === 'AI_DRAFT_APPROVED') draftsApproved++;

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

    // Si no hay aprobaciones explícitas de borradores registradas con AI_DRAFT_APPROVED,
    // podemos aproximarla por la cantidad de aprobaciones de ficha técnica del total
    const actualDraftsApproved = draftsApproved || aprobaciones;
    const aiAcceptanceRate = draftsCreated > 0
      ? Math.round((actualDraftsApproved / draftsCreated) * 100)
      : 100;

    res.json({
      resumen: {
        busquedas,
        aprobaciones,
        impresiones,
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
 * @route   GET /api/catalogos/tareas/:id
 * @desc    Obtiene el estado de progreso de una tarea de procesamiento de Excel en segundo plano.
 * @access  Privado (requiere privilegios de Administrador)
 */
router.get('/catalogos/tareas/:id', requireAdmin, (req, res) => {
  const task = taskManager.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }
  return res.json(task);
});

export default router;
