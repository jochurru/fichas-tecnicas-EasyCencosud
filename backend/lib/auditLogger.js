import crypto from 'crypto';
import { supabaseDb } from './supabase.js';

/**
 * Registra un evento de auditoría en la base de datos de manera no bloqueante.
 * 
 * @param {Object} req - Objeto Express Request (para extraer usuario, IP y correlation_id)
 * @param {Object} eventDetails - Detalles del evento a auditar
 * @param {string} eventDetails.accion - Acción realizada (LOGIN, PRODUCT_SEARCH, etc.)
 * @param {string} eventDetails.entidad - Tabla o tipo de entidad afectada (PRODUCTO, FICHA_TECNICA, etc.)
 * @param {string} [eventDetails.sku] - SKU involucrado en la acción (opcional)
 * @param {Object} [eventDetails.valores_anteriores] - Snapshot de valores antes del cambio (opcional)
 * @param {Object} [eventDetails.valores_nuevos] - Snapshot de valores después del cambio (opcional)
 * @param {string} [eventDetails.resultado] - Resultado de la operación ('SUCCESS' | 'FAILURE' | 'ERROR')
 */
export async function logAuditEvent(req, {
  accion,
  entidad,
  sku = null,
  valores_anteriores = null,
  valores_nuevos = null,
  resultado = 'SUCCESS'
}) {
  try {
    // 1. Resolver información del usuario autenticado
    const email = req?.user?.email || 'SYSTEM_GUEST';
    const role = req?.user?.role || req?.user?.rol || 'GUEST';

    // 2. Extraer IP del cliente
    let ip = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1';
    if (Array.isArray(ip)) {
      ip = ip[0];
    }
    // Truncar si la cabecera x-forwarded-for contiene múltiples IPs delegadas por proxies
    if (ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    // 3. Obtener o asignar correlation_id para trazar el flujo de la petición
    const correlationId = req?.correlationId || req?.headers['x-correlation-id'] || crypto.randomUUID();
    
    // Adjuntarlo de vuelta al request para logs de Express posteriores si es necesario
    if (req && !req.correlationId) {
      req.correlationId = correlationId;
    }

    // 4. Inserción no bloqueante en la base de datos Supabase
    supabaseDb
      .from('audit_logs')
      .insert([{
        usuario_email: email,
        rol: role,
        accion,
        entidad,
        sku: sku ? String(sku).trim() : null,
        valores_anteriores,
        valores_nuevos,
        resultado,
        ip_origen: ip,
        correlation_id: correlationId
      }])
      .then(({ error }) => {
        if (error) {
          console.error(`[AuditLogger] Error al escribir log de auditoría (${accion}):`, error.message);
        }
      })
      .catch((err) => {
        console.error(`[AuditLogger] Excepción al enviar log de auditoría (${accion}):`, err);
      });

  } catch (err) {
    console.error('[AuditLogger] Falla crítica al preparar log de auditoría:', err.message);
  }
}
