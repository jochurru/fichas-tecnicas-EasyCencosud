import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware.js';
import { supabaseDb } from '../lib/supabase.js';
import { logAuditEvent } from '../lib/auditLogger.js';
import { aiHealth } from '../lib/geminiExtractor.js';
import { getBrowser } from '../lib/pdf/browserManager.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

/**
 * GET /api/admin/estado-sistema
 * Retorna métricas en vivo del backend. Accesible para admin y superadmin.
 */
router.get('/admin/estado-sistema', requireAuth, requireRoles(['gerente', 'subadmin', 'jefe_sector', 'coordinador', 'admin', 'superadmin']), async (req, res) => {
  try {
    // DB Check
    let dbStatus = 'error';
    let dbLatency = 0;
    try {
      const start = Date.now();
      await supabaseDb.from('productos').select('sku').limit(1);
      dbLatency = Date.now() - start;
      dbStatus = 'ok';
    } catch (e) {
      console.error(e);
    }

    // PDF Check
    let pdfStatus = 'error';
    let activePages = 0;
    try {
      const browser = await getBrowser();
      if (browser && browser.connected) {
        pdfStatus = 'ok';
        const pages = await browser.pages();
        activePages = pages.length;
      }
    } catch (e) {
      console.error(e);
    }

    // Rate limiter check
    let rateLimiterStatus = 'fallback_memory';
    try {
      const { data, error } = await supabaseDb.from('gemini_rate_limits').select('*').limit(1);
      if (!error) {
        rateLimiterStatus = 'ok_db';
      }
    } catch (e) {
      console.error(e);
    }

    res.json({
      backend: {
        uptime: process.uptime(),
        env: process.env.NODE_ENV || 'development',
        serverTime: new Date().toISOString()
      },
      db: {
        status: dbStatus,
        latencyMs: dbLatency
      },
      pdf: {
        status: pdfStatus,
        activePages: activePages,
        maxPages: 3 // hardcoded in pdfGenerator but we can just say 3
      },
      ai: aiHealth,
      rateLimiter: {
        status: rateLimiterStatus
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/database-viewer
 * Visor de Base de Datos para Superadmin (Solo Lectura)
 */
const ALLOWED_TABLES = ['productos', 'fichas_historial', 'codigos_ean', 'usuarios_roles', 'audit_logs'];

router.get('/admin/database-viewer', requireAuth, requireRoles(['gerente', 'superadmin']), async (req, res) => {
  try {
    const { tableName, limit = 50, offset = 0 } = req.query;

    if (!tableName || !ALLOWED_TABLES.includes(tableName)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Tabla no permitida o no especificada.' });
    }

    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 1000);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const { data, error, count } = await supabaseDb
      .from(tableName)
      .select('*', { count: 'exact' })
      .range(parsedOffset, parsedOffset + parsedLimit - 1);

    if (error) {
      throw error;
    }

    // Registrar en audit_logs
    logAuditEvent(req, {
      accion: 'DB_SUPERADMIN_READ',
      entidad: 'DATABASE',
      valores_nuevos: { tabla_consultada: tableName, limit: parsedLimit, offset: parsedOffset }
    });

    res.json({
      data,
      totalCount: count,
      pageInfo: {
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
  } catch (error) {
    console.error('[DB Viewer] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
