import { supabase } from '../lib/supabase.js';

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
 * Middleware para requerir privilegios de administrador.
 * Valida el token JWT y se asegura de que pertenezca al correo de administrador.
 */
export async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Se requiere un token de autorización Bearer válido en el encabezado.' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'El token de acceso es inválido o ha expirado.' 
      });
    }

    // Validar rol de administrador por correo
    if (user.email !== 'admin@easy.com.ar') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Acceso denegado: Se requieren privilegios de administrador para realizar esta acción.'
      });
    }

    req.user = user;
    next();

  } catch (err) {
    console.error('[AuthMiddleware] Error crítico al verificar privilegios de Admin:', err.message);
    return res.status(500).json({ 
      error: 'Error interno de autorización',
      message: err.message
    });
  }
}
