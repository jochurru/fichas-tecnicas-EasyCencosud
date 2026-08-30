import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware.js';
import { supabase, supabaseDb, supabaseAdmin } from '../lib/supabase.js';
import { logAuditEvent } from '../lib/auditLogger.js';
import { getAllowedSectorsForUser } from '../config/storeBlocks.js';

const router = Router();

/**
 * Genera una contraseña temporal segura aleatoria de 8 caracteres (ej: Easy#8f9A)
 */
function generateTempPassword() {
  const envTemp = process.env.DEFAULT_TEMP_PASSWORD;
  if (envTemp && envTemp.trim().length >= 6) {
    return envTemp.trim();
  }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let randStr = '';
  for (let i = 0; i < 4; i++) {
    randStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Easy#${randStr}`;
}

/**
 * @route   GET /api/admin/usuarios/validar-email
 * @desc    Valida si un email ya existe y sugiere variaciones si está ocupado
 * @access  Privado (Jefes, Subadmin, Gerente)
 */
router.get('/admin/usuarios/validar-email', requireAuth, async (req, res, next) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'El parámetro email es requerido.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const { data: existing } = await supabaseDb
      .from('profiles')
      .select('id, email')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      const parts = cleanEmail.split('@');
      const suggestedEmail = `${parts[0]}1@${parts[1] || 'easy.com.ar'}`;
      return res.json({
        exists: true,
        message: `El usuario ${cleanEmail} ya existe en el sistema.`,
        suggestedEmail
      });
    }

    return res.json({ exists: false, message: 'Email disponible.' });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/admin/usuarios
 * @desc    Lista los usuarios (los Jefes solo ven hacia abajo: coordinadores y vendedores de su bloque)
 * @access  Privado
 */
router.get('/admin/usuarios', requireAuth, async (req, res, next) => {
  try {
    const userRole = req.user.role || 'operador';

    let query = supabaseDb.from('profiles').select('*, sectores(nombre)');

    // Si es Jefe de Sector: solo ve roles subordinados (coordinador y vendedor) de sus sectores
    if (userRole === 'jefe_sector') {
      query = query.in('rol', ['coordinador', 'operador', 'operator']);
      const allowedSectors = getAllowedSectorsForUser(req.user);
      if (allowedSectors.length > 0) {
        query = query.in('sector_id', allowedSectors);
      }
    } else if (userRole === 'coordinador' || userRole === 'operador') {
      // Un coordinador u operador no lista usuarios
      return res.json([]);
    }

    const { data: users, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(users || []);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/admin/usuarios
 * @desc    Crea un nuevo usuario en Supabase Auth y profiles con contraseña temporal
 * @access  Privado (Jefes, Subadmin, Gerente)
 */
router.post('/admin/usuarios', requireAuth, requireRoles(['gerente', 'subadmin', 'jefe_sector']), async (req, res, next) => {
  const { email, nombre, rol, sector_id } = req.body;

  if (!email || !nombre || !rol) {
    return res.status(400).json({ error: 'Email, nombre y rol son obligatorios.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const tempPassword = generateTempPassword();
  const targetSector = sector_id || req.user.sector_id || 1;

  try {
    // Si es Jefe de Sector, solo puede crear coordinadores o vendedores
    if (req.user.role === 'jefe_sector' && !['coordinador', 'operador'].includes(rol)) {
      return res.status(403).json({ error: 'Como Jefe de Sector solo podés dar de alta cuentas de Coordinadores y Vendedores.' });
    }

    // 1. Verificar unicidad de email
    const { data: existing } = await supabaseDb
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: `El correo ${cleanEmail} ya se encuentra registrado.` });
    }

    // 2. Crear usuario en Supabase Auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nombre, rol }
    });

    if (authErr) {
      return res.status(400).json({ error: 'Error al crear usuario en Auth: ' + authErr.message });
    }

    const userId = authData.user.id;

    // 3. Crear perfil en la tabla profiles
    const { data: profile, error: profileErr } = await supabaseDb
      .from('profiles')
      .insert({
        id: userId,
        email: cleanEmail,
        nombre: nombre.trim(),
        rol: rol,
        sector_id: targetSector,
        must_change_password: true,
        temp_password: bcrypt.hashSync(tempPassword, 10),
        activo: true
      })
      .select()
      .single();

    if (profileErr) {
      // Rollback Auth si falla el perfil
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw profileErr;
    }

    logAuditEvent(req, {
      accion: 'CREATE_USER',
      entidad: 'USUARIO',
      entidad_id: userId,
      valores_nuevos: { email: cleanEmail, rol, sector_id: targetSector }
    });

    return res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente con clave temporal.',
      user: profile,
      tempPassword: tempPassword
    });

  } catch (err) {
    console.error('[AdminUsers] Error al crear usuario:', err.message);
    next(err);
  }
});

/**
 * @route   POST /api/admin/usuarios/:id/reset-temp-password
 * @desc    Regenera la clave temporal para un usuario que olvidó su clave previa al primer login
 * @access  Privado (Jefes, Subadmin, Gerente)
 */
router.post('/admin/usuarios/:id/reset-temp-password', requireAuth, requireRoles(['gerente', 'subadmin', 'jefe_sector']), async (req, res, next) => {
  const { id } = req.params;
  const userRole = req.user.role || 'operador';
  const tempPassword = generateTempPassword();

  try {
    // Si es Jefe de Sector, verificar que el usuario destino sea estrictamente subordinado
    if (userRole === 'jefe_sector') {
      const { data: targetUser } = await supabaseDb.from('profiles').select('rol, sector_id').eq('id', id).maybeSingle();
      if (!targetUser || ['gerente', 'subadmin', 'jefe_sector', 'admin', 'superadmin'].includes(targetUser.rol)) {
        return res.status(403).json({ error: 'No tenés permisos para resetear la contraseña de un superior o par jerárquico.' });
      }
    }
    // Actualizar clave en Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: tempPassword
    });

    if (authErr) throw authErr;

    // Marcar must_change_password = true
    const { data: profile, error: profileErr } = await supabaseDb
      .from('profiles')
      .update({
        must_change_password: true,
        temp_password: bcrypt.hashSync(tempPassword, 10),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (profileErr) throw profileErr;

    logAuditEvent(req, {
      accion: 'RESET_TEMP_PASSWORD',
      entidad: 'USUARIO',
      entidad_id: id
    });

    return res.json({
      success: true,
      message: 'Clave temporal regenerada exitosamente.',
      tempPassword: tempPassword,
      user: profile
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PATCH /api/admin/usuarios/:id/status
 * @desc    Activa o desactiva un usuario (Baja lógica)
 * @access  Privado (Gerente y Subadmin)
 */
router.patch('/admin/usuarios/:id/status', requireAuth, requireRoles(['gerente', 'subadmin']), async (req, res, next) => {
  const { id } = req.params;
  const { activo } = req.body;
  const callerRole = req.user?.role || 'operador';

  if (id === req.user?.id) {
    return res.status(403).json({ error: 'Forbidden', message: 'No podés modificar tu propio estado.' });
  }

  try {
    const { data: targetUser } = await supabaseDb.from('profiles').select('rol').eq('id', id).maybeSingle();
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (['superadmin', 'gerente'].includes(targetUser.rol) && callerRole !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden', message: 'No tenés permisos para modificar el estado de un superior o par directivo.' });
    }

    const { data: profile, error } = await supabaseDb
      .from('profiles')
      .update({ activo: !!activo, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logAuditEvent(req, {
      accion: activo ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entidad: 'USUARIO',
      entidad_id: id
    });

    return res.json({ success: true, user: profile });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   DELETE /api/admin/usuarios/:id
 * @desc    Elimina definitivamente un usuario (Baja física)
 * @access  Privado Exclusivo (Gerente y Subadmin)
 */
router.delete('/admin/usuarios/:id', requireAuth, requireRoles(['gerente', 'subadmin']), async (req, res, next) => {
  const { id } = req.params;
  const callerRole = req.user?.role || 'operador';

  if (id === req.user?.id) {
    return res.status(403).json({ error: 'Forbidden', message: 'No podés eliminar tu propia cuenta.' });
  }

  try {
    const { data: targetUser } = await supabaseDb.from('profiles').select('rol').eq('id', id).maybeSingle();
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (['superadmin', 'gerente'].includes(targetUser.rol) && callerRole !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden', message: 'No tenés permisos para eliminar a un superior o par directivo.' });
    }

    // 1. Eliminar de Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authErr) throw authErr;

    // 2. Eliminar de profiles
    await supabaseDb.from('profiles').delete().eq('id', id);

    logAuditEvent(req, {
      accion: 'DELETE_USER',
      entidad: 'USUARIO',
      entidad_id: id
    });

    return res.json({ success: true, message: 'Usuario eliminado permanentemente.' });
  } catch (err) {
    next(err);
  }
});

export default router;
