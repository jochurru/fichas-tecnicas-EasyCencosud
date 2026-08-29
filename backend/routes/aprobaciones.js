import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware.js';
import { supabaseDb } from '../lib/supabase.js';
import { logAuditEvent } from '../lib/auditLogger.js';

const router = Router();

/**
 * @route   GET /api/aprobaciones/pendientes
 * @desc    Obtiene las fichas borradores pendientes de aprobación (filtradas por sector)
 * @access  Privado (Coordinadores, Jefes de Sector, Subadmins, Gerente)
 */
router.get('/aprobaciones/pendientes', requireAuth, requireRoles(['gerente', 'subadmin', 'jefe_sector', 'coordinador']), async (req, res, next) => {
  try {
    const userRole = req.user.role || 'operador';
    const userSector = req.user.sector_id || 1;
    const { sector_id } = req.query;

    let query = supabaseDb
      .from('fichas_tecnicas')
      .select('*, sectores(nombre)')
      .in('estado', ['GENERADA_POR_IA', 'PENDIENTE_VALIDACION', 'generada_ia', 'pendiente_revision']);

    // Si es Coordinador o Jefe de Sector, filtra por su sector asignado
    if (userRole === 'jefe_sector' || userRole === 'coordinador') {
      query = query.eq('sector_id', userSector);
    } else if (sector_id) {
      query = query.eq('sector_id', parseInt(sector_id, 10));
    }

    const { data: fichas, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(fichas || []);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/aprobaciones/:id/aprobar
 * @desc    Aprueba y publica oficialmente una ficha técnica borrador
 * @access  Privado (Coordinadores, Jefes de Sector, Subadmins, Gerente)
 */
router.post('/aprobaciones/:id/aprobar', requireAuth, requireRoles(['gerente', 'subadmin', 'jefe_sector', 'coordinador']), async (req, res, next) => {
  const { id } = req.params;
  const { foto_url, especificaciones, observaciones } = req.body;

  try {
    const updates = {
      estado: 'APROBADA',
      aprobado_por: req.user.id,
      observaciones_revision: observaciones || null,
      updated_at: new Date().toISOString()
    };

    if (foto_url) {
      updates.foto_url = foto_url;
    }
    if (especificaciones) {
      updates.especificaciones = especificaciones;
    }

    const { data: ficha, error } = await supabaseDb
      .from('fichas_tecnicas')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logAuditEvent(req, {
      accion: 'APPROVE_FICHA',
      entidad: 'FICHA_TECNICA',
      entidad_id: id,
      valores_nuevos: { estado: 'APROBADA', aprobado_por: req.user.id }
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
 * @desc    Devuelve una ficha borrador con observaciones para corrección
 * @access  Privado (Coordinadores, Jefes de Sector, Subadmins, Gerente)
 */
router.post('/aprobaciones/:id/rechazar', requireAuth, requireRoles(['gerente', 'subadmin', 'jefe_sector', 'coordinador']), async (req, res, next) => {
  const { id } = req.params;
  const { observaciones } = req.body;

  if (!observaciones || !observaciones.trim()) {
    return res.status(400).json({ error: 'Debe especificar el motivo del rechazo u observaciones.' });
  }

  try {
    const { data: ficha, error } = await supabaseDb
      .from('fichas_tecnicas')
      .update({
        estado: 'OBSERVADA',
        observaciones_revision: observaciones.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logAuditEvent(req, {
      accion: 'REJECT_FICHA',
      entidad: 'FICHA_TECNICA',
      entidad_id: id,
      valores_nuevos: { estado: 'rechazado', observaciones: observaciones.trim() }
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
