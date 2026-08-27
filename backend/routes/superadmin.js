import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware.js';
import { supabaseDb } from '../lib/supabase.js';
import { logAuditEvent } from '../lib/auditLogger.js';
import { aiHealth } from '../lib/geminiExtractor.js';
import { getBrowser } from '../lib/pdfGenerator.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

/**
 * GET /api/admin/estado-sistema
 * Retorna métricas en vivo del backend. Accesible para admin y superadmin.
 */
router.get('/admin/estado-sistema', requireAuth, requireRoles(['admin']), async (req, res) => {
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
      if (browser && browser.isConnected()) {
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
      const { data, error } = await supabaseDb.from('gemini_rate_limits').select('id').limit(1);
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

export default router;
