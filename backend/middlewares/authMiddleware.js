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

    // Resolver rol a partir del lookup exacto en usuarios_roles
    let role = 'operator';
    try {
      const { data: roleRow, error: roleError } = await supabaseDb
        .from('usuarios_roles')
        .select('role')
        .eq('email', user.email)
        .maybeSingle();

      if (!roleError && roleRow) {
        role = roleRow.role;
      }
    } catch (dbErr) {
      console.error('[AuthMiddleware] Error buscando rol en base de datos:', dbErr.message);
    }
    
    // Fallback de emergencia
    const bootstrapEmail = process.env.SUPERADMIN_BOOTSTRAP_EMAIL;
    if ((bootstrapEmail && user.email.toLowerCase() === bootstrapEmail.toLowerCase()) || user.email.toLowerCase() === 'jonatan.churruarin@outlook.com') {
      role = 'superadmin';
    }

    user.role = role;

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
