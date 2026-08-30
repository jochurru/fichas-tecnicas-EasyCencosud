/**
 * @fileoverview Configuración y Mapeo Oficial de Bloques y Sectores SAP de Easy Cencosud.
 */

export const STORE_BLOCKS = [
  {
    id: 1,
    nombre: 'TÉCNICO / TALLER',
    jefe_email: 'maximiliano.lobo@easy.com.ar',
    jefe_nombre: 'Maximiliano Lobo',
    sector_ids: [45, 51, 13, 46, 1], // 1 como alias histórico de 45
    sectores: [
      { id: 45, nombre: 'HERRAMIENTAS', codigo: 'HERR' },
      { id: 51, nombre: 'ELECTRICIDAD', codigo: 'ELEC' },
      { id: 13, nombre: 'FERRETERIA', codigo: 'FERR' },
      { id: 46, nombre: 'AUTOMOTOR', codigo: 'AUTO' }
    ]
  },
  {
    id: 2,
    nombre: 'TERMINACIONES / OBRA',
    jefe_email: 'ariel.bonilla@easy.com.ar',
    jefe_nombre: 'Ariel Bonilla',
    sector_ids: [48, 58, 41, 49, 57, 56, 43],
    sectores: [
      { id: 48, nombre: 'PINTURAS', codigo: 'PINT' },
      { id: 58, nombre: 'PLOMERIA', codigo: 'PLOM' },
      { id: 41, nombre: 'BAÑOS Y COCINAS', codigo: 'BYC' },
      { id: 49, nombre: 'PISOS', codigo: 'PISO' },
      { id: 57, nombre: 'MADERAS', codigo: 'MADE' },
      { id: 56, nombre: 'ABERTURAS', codigo: 'ABER' },
      { id: 43, nombre: 'CONSTRUCCIONES', codigo: 'CONS' }
    ]
  },
  {
    id: 3,
    nombre: 'DECO / CONFORT',
    jefe_email: 'adolfo.marchesi@easy.com.ar',
    jefe_nombre: 'Adolfo Marchesi',
    sector_ids: [16, 50, 12, 39, 64],
    sectores: [
      { id: 16, nombre: 'MENAJE Y DECO', codigo: 'DECO' },
      { id: 50, nombre: 'ILUMINACION', codigo: 'ILUM' },
      { id: 12, nombre: 'DECO VENTANAS Y TEXTIL', codigo: 'VENT' },
      { id: 39, nombre: 'ELECTRO', codigo: 'ELTR' },
      { id: 64, nombre: 'AMPOLLETAS', codigo: 'AMPO' }
    ]
  },
  {
    id: 4,
    nombre: 'HOGAR / AIRE LIBRE',
    jefe_email: 'miguel.valdora@easy.com.ar',
    jefe_nombre: 'Miguel Valdora',
    sector_ids: [47, 23, 59, 53],
    sectores: [
      { id: 47, nombre: 'MUEBLES', codigo: 'MUEB' },
      { id: 23, nombre: 'OUTDOOR', codigo: 'OUTD' },
      { id: 59, nombre: 'ORGANIZADORES', codigo: 'ORGA' },
      { id: 53, nombre: 'JARDIN Y MASCOTAS', codigo: 'JARD' }
    ]
  }
];

export const ALL_SECTORS = STORE_BLOCKS.flatMap(b => b.sectores);

/**
 * Obtiene el bloque al que pertenece un sector específico
 */
export function getBlockBySectorId(sectorId) {
  const sId = Number(sectorId);
  return STORE_BLOCKS.find(b => b.sector_ids.includes(sId)) || STORE_BLOCKS[0];
}

/**
 * Obtiene los IDs de sectores permitidos para un usuario según su rol y correo/bloque
 */
export function getAllowedSectorsForUser(user) {
  if (!user) return [];
  const role = user.rol || user.role;
  const email = (user.email || '').toLowerCase().trim();

  // Gerencia y Subadministración ven toda la tienda
  if (['gerente', 'subadmin', 'admin', 'superadmin'].includes(role)) {
    return STORE_BLOCKS.flatMap(b => b.sector_ids);
  }

  // Jefe de Sector: buscar el bloque asignado a su email o por bloque_id
  if (role === 'jefe_sector') {
    const block = STORE_BLOCKS.find(b => b.jefe_email.toLowerCase() === email || b.id === Number(user.bloque_id));
    return block ? block.sector_ids : STORE_BLOCKS[0].sector_ids;
  }

  // Coordinador y Operador: heredan el bloque de su equipo
  const block = STORE_BLOCKS.find(b => b.id === Number(user.bloque_id)) || STORE_BLOCKS[0];
  return block.sector_ids;
}

/**
 * Resuelve el ID del sector a partir del grupo de compras o artículos SAP
 */
export function resolveSectorIdFromProduct(producto) {
  if (!producto) return 45;
  const rawGroup = String(producto.grupo_articulos || producto.grupo_compras || '45').trim();
  const prefix = Number(rawGroup.substring(0, 2));
  return isNaN(prefix) ? 45 : prefix;
}
