import { z } from 'zod';

/**
 * Middleware genérico para validar peticiones Express contra un esquema Zod.
 * 
 * @param {z.ZodSchema} schema - Esquema de validación Zod
 * @param {string} targetKey - Atributo del request a validar ('body' | 'query' | 'params')
 */
export const validateSchema = (schema, targetKey = 'body') => {
  return (req, res, next) => {
    try {
      const targetData = targetKey === 'params' 
        ? req.params 
        : (targetKey === 'query' ? req.query : req.body);
        
      const parsed = schema.parse(targetData);
      
      // Reemplazar con los datos parseados y sanitizados
      if (targetKey === 'params') req.params = parsed;
      else if (targetKey === 'query') req.query = parsed;
      else req.body = parsed;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return res.status(400).json({
          error: 'Error de Validación',
          message: errorMessages
        });
      }
      next(error);
    }
  };
};

// 1. Esquema: Auth (/api/auth/login)
export const loginSchema = z.object({
  email: z.string()
    .trim()
    .min(1, 'El correo electrónico es obligatorio.')
    .email('El formato del correo electrónico es inválido.')
    .refine(
      (val) => val.endsWith('@easy.com.ar') || val.endsWith('@cencosud.com.ar'),
      { message: 'El dominio del correo debe ser institucional (@easy.com.ar o @cencosud.com.ar).' }
    ),
  password: z.string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres.')
    .max(100, 'La contraseña es demasiado larga.')
});

// 2. Esquema: Búsqueda (/api/producto/:identificador)
export const searchSchema = z.object({
  identificador: z.string()
    .trim()
    .min(1, 'El identificador de producto es requerido.')
    .max(50, 'El identificador no puede superar los 50 caracteres.')
    .regex(/^[a-zA-Z0-9-]+$/, 'El identificador de producto contiene caracteres no permitidos.')
});

// 3. Esquema: Ficha Técnica (/api/fichas/aprobar)
export const approveFichaSchema = z.object({
  sku: z.string()
    .trim()
    .min(1, 'El SKU es obligatorio.')
    .regex(/^[a-zA-Z0-9-]+$/, 'El SKU debe ser alfanumérico limpio.'),
  especificaciones_json: z.object({
    marca: z.string()
      .trim()
      .min(1, 'La marca es obligatoria.')
      .max(100, 'Nombre de marca demasiado largo.'),
    tipo_herramienta: z.string()
      .trim()
      .min(1, 'El tipo de herramienta es obligatorio.')
      .max(100, 'Tipo de herramienta demasiado largo.'),
    especificaciones: z.array(
      z.object({
        clave: z.string().trim().min(1, 'La clave del atributo no puede estar vacía.').max(100),
        valor: z.string().trim().min(1, 'El valor del atributo no puede estar vacío.').max(500),
        origen: z.string().trim().optional(),
        fecha_validacion: z.string().trim().optional()
      })
    ),
    sugerencia_busqueda_imagen: z.string().trim().optional().nullable()
  }),
  template_preferido: z.number().int().min(1).max(3),
  foto_url: z.string()
    .trim()
    .nullable()
    .or(z.literal(''))
    .refine(
      (val) => {
        if (!val) return true;
        try {
          const url = new URL(val);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'La URL de la foto del producto no tiene un formato web válido.' }
    ),
  aprobado_por: z.string()
    .trim()
    .min(1, 'El nombre de aprobador es obligatorio.')
    .max(255),
  ean: z.string()
    .trim()
    .nullable()
    .or(z.literal(''))
    .refine(
      (val) => {
        if (!val) return true;
        return /^\d+$/.test(val) && val.length <= 20;
      },
      { message: 'El código EAN debe ser una cadena numérica limpia.' }
    ),
  estado: z.enum([
    'SIN_FICHA',
    'BORRADOR',
    'GENERADA_POR_IA',
    'PENDIENTE_VALIDACION',
    'APROBADA',
    'OBSERVADA',
    'DESACTUALIZADA',
    'VENCIDA'
  ]).optional().default('APROBADA')
});

// 4. Esquemas: Impresión (GET & POST)
export const printGetParamsSchema = z.object({
  sku: z.string()
    .trim()
    .regex(/^[a-zA-Z0-9-]+$/, 'El SKU debe ser alfanumérico.')
});

export const printGetQuerySchema = z.object({
  template: z.enum(['a4', 'fleje3', 'fleje2']).optional().default('fleje3'),
  action: z.enum(['preview', 'print']).optional().default('print')
});

export const printPostSchema = z.object({
  sku: z.string()
    .trim()
    .regex(/^[a-zA-Z0-9-]+$/, 'El SKU debe ser alfanumérico.'),
  template: z.enum(['a4', 'fleje3', 'fleje2']).optional().default('fleje3'),
  action: z.enum(['preview', 'print']).optional().default('print')
});

// 5. Esquema: Carga Excel SAP (/api/catalogos/importar e importar-eans)
export const excelUploadSchema = z.object({
  fileBase64: z.string({ required_error: 'El archivo Excel codificado en Base64 es obligatorio.' })
    .min(1, 'La cadena de archivo no puede estar vacía.')
    .refine(
      (base64Str) => {
        try {
          const buffer = Buffer.from(base64Str, 'base64');
          // Validar peso de archivo: Máx 10 MB
          const maxSize = 10 * 1024 * 1024;
          return buffer.length <= maxSize;
        } catch {
          return false;
        }
      },
      { message: 'El archivo Excel supera el tamaño límite permitido de 10 MB.' }
    )
    .refine(
      (base64Str) => {
        try {
          const buffer = Buffer.from(base64Str, 'base64');
          if (buffer.length < 4) return false;
          
          // Leer la cabecera hexadecimal del archivo
          const hex = buffer.toString('hex', 0, 4);
          
          // Cabecera ZIP (.xlsx) = '504b0304' (PK..)
          // Cabecera OLE2 (.xls) = 'd0cf11e0'
          return hex === '504b0304' || hex === 'd0cf11e0';
        } catch {
          return false;
        }
      },
      { message: 'Tipo de archivo no permitido. Debe ser un archivo válido Excel (.xlsx o .xls)' }
    )
});
