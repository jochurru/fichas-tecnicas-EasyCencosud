import { supabase, supabaseDb } from '../lib/supabase.js';

/**
 * Middleware para requerir autenticación de Supabase Auth.
 * Valida el token JWT en el encabezado Authorization y adjunta el usuario a la request.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Se requiere un token de autorización Bearer válido en el encabezado.' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Validar el token JWT de forma oficial usando el SDK de Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'El token de acceso es inválido o ha expirado.' 
      });
    }

    // Resolver rol y sector con resolución multicapa (user_metadata, profiles por ID, profiles por email, usuarios_roles)
    let role = user.user_metadata?.rol || user.user_metadata?.role || 'operador';
    let sectorId = user.user_metadata?.sector_id || 1;

    try {
      let { data: profileRow } = await supabaseDb
        .from('profiles')
        .select('rol, sector_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileRow && user.email) {
        const { data: byEmail } = await supabaseDb
          .from('profiles')
          .select('rol, sector_id')
          .eq('email', user.email.toLowerCase())
          .maybeSingle();
        if (byEmail) profileRow = byEmail;
      }

      if (profileRow) {
        if (profileRow.activo === false) {
          return res.status(403).json({ 
            error: 'Account Disabled', 
            message: 'Tu cuenta ha sido desactivada por un administrador. Contactá a tu jefe de sector.' 
          });
        }
        role = profileRow.rol || role;
        sectorId = profileRow.sector_id || sectorId;
      } else {
        const { data: roleRow } = await supabaseDb
          .from('usuarios_roles')
          .select('role')
          .eq('email', user.email)
          .maybeSingle();

        if (roleRow && roleRow.role) {
          role = roleRow.role;
        }
      }
    } catch (dbErr) {
      console.error('[AuthMiddleware] Error buscando perfil en base de datos:', dbErr.message);
    }
    
    // Fallback de emergencia: solo en desarrollo o si no hay superadmins en DB
    const bootstrapEmail = process.env.SUPERADMIN_BOOTSTRAP_EMAIL;
    if (bootstrapEmail && user.email.toLowerCase() === bootstrapEmail.toLowerCase()) {
      const isProduction = process.env.NODE_ENV === 'production';
      if (!isProduction) {
        console.warn('[AuthMiddleware] ⚠️ SUPERADMIN_BOOTSTRAP activado para:', user.email);
        role = 'superadmin';
      }
    }

    user.role = role;
    user.sector_id = sectorId;

    // Inyectar el usuario en la request para controladores posteriores
    req.user = user;
    next();

  } catch (err) {
    console.error('[AuthMiddleware] Error crítico al verificar JWT:', err.message);
    return res.status(500).json({ 
      error: 'Error interno de autenticación',
      message: err.message
    });
  }
}

/**
 * Middleware para requerir roles específicos.
 */
export function requireRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.role === 'superadmin' || allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({
      error: 'Forbidden',
      message: `Acceso denegado: Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}.`
    });
  };
}

/**
 * Jerarquía numérica de roles para control de acceso basado en nivel mínimo.
 */
export const ROLE_HIERARCHY = {
  superadmin: 6,
  gerente: 5,
  subadmin: 4,
  jefe_sector: 3,
  coordinador: 2,
  operador: 1
};

/**
 * Middleware para requerir un nivel jerárquico mínimo.
 */
export function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 99;
    if (userLevel >= requiredLevel) return next();
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: `Se requiere nivel mínimo de ${minRole}.` 
    });
  };
}
