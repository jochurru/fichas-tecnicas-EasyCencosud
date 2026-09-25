import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware.js';
import { supabaseDb } from '../lib/supabase.js';
import { logAuditEvent } from '../lib/auditLogger.js';
import { getAllowedSectorsForUser } from '../config/storeBlocks.js';
import { buildSuggestionRejectionUpdate } from '../lib/fichaWorkflow.js';
import { OFFICIAL_EDITOR_ROLES } from '../lib/rolePolicy.js';

const router = Router();

/**
 * @route   GET /api/aprobaciones/pendientes
 * @desc    Obtiene la lista de fichas en borrador o pendientes de validación
 * @access  Privado (Coordinadores, Jefes de Sector, Subadmins, Gerente)
 */
router.get('/aprobaciones/pendientes', requireAuth, requireRoles(OFFICIAL_EDITOR_ROLES), async (req, res, next) => {
  try {
    const userRole = req.user.role || 'operador';
    const { sector_id } = req.query;

    let query = supabaseDb
      .from('fichas_tecnicas')
      .select('*, sectores(nombre)')
      .in('estado', ['PENDIENTE_VALIDACION', 'pendiente_revision']);

    // Si es Coordinador o Jefe de Sector, filtra por los sectores que integran su bloque
    if (['jefe_sector', 'coordinador', 'coordinator'].includes(userRole)) {
      const allowedSectors = getAllowedSectorsForUser(req.user);
      if (sector_id) {
        const requestedSector = parseInt(sector_id, 10);
        if (!allowedSectors.includes(requestedSector)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'No podés consultar aprobaciones de otro bloque.'
          });
        }
        query = query.eq('sector_id', requestedSector);
      } else if (allowedSectors.length > 0) {
        query = query.in('sector_id', allowedSectors);
      }
    } else if (sector_id) {
      query = query.eq('sector_id', parseInt(sector_id, 10));
    }

    const { data: fichas, error } = await query.order('updated_at', { ascending: false });

    if (error) throw error;
    const pending = (fichas || []).map((ficha) => ({
      ...ficha,
      especificaciones_oficiales_json: ficha.especificaciones_json,
      especificaciones_json: ficha.especificaciones_propuestas_json || ficha.especificaciones_json
    }));

    return res.json(pending);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/aprobaciones/:id/aprobar
 * @desc    Aprueba y publica oficialmente una ficha técnica borrador
 * @access  Privado (Coordinadores, Jefes de Sector, Subadmins, Gerente)
 */
router.post('/aprobaciones/:id/aprobar', requireAuth, requireRoles(OFFICIAL_EDITOR_ROLES), async (req, res, next) => {
  const { id } = req.params;
  const { foto_url, especificaciones, observaciones, template_preferido } = req.body;

  try {
    // La ficha oficial permanece intacta hasta este punto.
    const { data: existingFicha } = await supabaseDb
      .from('fichas_tecnicas')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existingFicha) {
      return res.status(404).json({ error: 'Ficha técnica no encontrada.' });
    }

    const allowedSectors = getAllowedSectorsForUser(req.user);
    if (existingFicha.sector_id && !allowedSectors.includes(Number(existingFicha.sector_id))) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No podés aprobar fichas de otro bloque.'
      });
    }

    const approvedSpecs = especificaciones || existingFicha.especificaciones_propuestas_json;
    if (!approvedSpecs) {
      return res.status(400).json({ error: 'La ficha no contiene una propuesta técnica para aprobar.' });
    }

    const updates = {
      estado: 'APROBADA',
      especificaciones_json: approvedSpecs,
      especificaciones_propuestas_json: null,
      propuesto_por: null,
      propuesto_at: null,
      estado_previo: null,
      aprobado_por: req.user.id,
      observaciones_revision: observaciones || null,
      updated_at: new Date().toISOString()
    };

    if (foto_url) {
      updates.foto_url = foto_url;
    }
    if (template_preferido) {
      updates.template_preferido = template_preferido;
    }

    const { data: ficha, error } = await supabaseDb
      .from('fichas_tecnicas')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const { data: lastHist } = await supabaseDb
      .from('fichas_historial')
      .select('version')
      .eq('sku', existingFicha.sku)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabaseDb.from('fichas_historial').insert([{
      sku: existingFicha.sku,
      version: lastHist ? lastHist.version + 1 : 1,
      especificaciones_json: approvedSpecs,
      foto_url: updates.foto_url || existingFicha.foto_url,
      origen_cambio: 'APROBACION_COORDINADOR',
      modificado_por: req.user.email
    }]);

    const cacheFiles = [
      `${existingFicha.sku}_a4.pdf`,
      `${existingFicha.sku}_fleje3.pdf`,
      `${existingFicha.sku}_fleje2.pdf`,
      `${existingFicha.sku}_robust_a4.pdf`,
      `${existingFicha.sku}_robust_fleje3.pdf`,
      `${existingFicha.sku}_robust_fleje2.pdf`
    ];
    await supabaseDb.storage.from('fichas-pdf').remove(cacheFiles);

    logAuditEvent(req, {
      accion: 'APPROVE_FICHA',
      entidad: 'FICHA_TECNICA',
      sku: existingFicha.sku,
      valores_anteriores: existingFicha.especificaciones_json,
      valores_nuevos: approvedSpecs
    });

    return res.json({
      success: true,
      message: 'Ficha técnica aprobada y publicada oficialmente.',
      ficha
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/aprobaciones/:id/rechazar
 * @desc    Rechaza una sugerencia técnica sin modificar datos ni imágenes oficiales.
 * @access  Privado (Coordinadores, Jefes de Sector, Subadmins, Gerente)
 */
router.post('/aprobaciones/:id/rechazar', requireAuth, requireRoles(OFFICIAL_EDITOR_ROLES), async (req, res, next) => {
  const { id } = req.params;
  const { observaciones } = req.body;

  if (!observaciones || !observaciones.trim()) {
    return res.status(400).json({ error: 'Debe especificar el motivo del rechazo u observaciones.' });
  }

  try {
    const { data: existingFicha } = await supabaseDb
      .from('fichas_tecnicas')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existingFicha) {
      return res.status(404).json({ error: 'Ficha técnica no encontrada.' });
    }

    const allowedSectors = getAllowedSectorsForUser(req.user);
    if (existingFicha.sector_id && !allowedSectors.includes(Number(existingFicha.sector_id))) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No podés rechazar fichas de otro bloque.'
      });
    }

    const { data: ficha, error } = await supabaseDb
      .from('fichas_tecnicas')
      .update(buildSuggestionRejectionUpdate(observaciones, existingFicha.estado_previo || 'APROBADA'))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logAuditEvent(req, {
      accion: 'REJECT_FICHA',
      entidad: 'FICHA_TECNICA',
      sku: existingFicha.sku,
      valores_anteriores: existingFicha.especificaciones_propuestas_json,
      valores_nuevos: { estado: existingFicha.estado_previo || 'APROBADA', observaciones: observaciones.trim() }
    });

    return res.json({
      success: true,
      message: 'Ficha técnica rechazada con observaciones.',
      ficha
    });
  } catch (err) {
    next(err);
  }
});

export default router;
