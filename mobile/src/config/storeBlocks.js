/**
 * @fileoverview Mapeo Oficial de Bloques y Sectores SAP en el Frontend.
 */

export const STORE_BLOCKS = [
  {
    id: 1,
    nombre: 'TÉCNICO / TALLER',
    jefe_email: 'maximiliano.lobo@easy.com.ar',
    jefe_nombre: 'Maximiliano Lobo',
    sector_ids: [45, 51, 13, 46, 1],
    sectores: [
      { id: 45, nombre: 'Herramientas', codigo: 'HERR' },
      { id: 51, nombre: 'Electricidad', codigo: 'ELEC' },
      { id: 13, nombre: 'Ferretería', codigo: 'FERR' },
      { id: 46, nombre: 'Automotor', codigo: 'AUTO' }
    ]
  },
  {
    id: 2,
    nombre: 'TERMINACIONES / OBRA',
    jefe_email: 'ariel.bonilla@easy.com.ar',
    jefe_nombre: 'Ariel Bonilla',
    sector_ids: [48, 58, 41, 49, 57, 56, 43],
    sectores: [
      { id: 48, nombre: 'Pinturas', codigo: 'PINT' },
      { id: 58, nombre: 'Plomería', codigo: 'PLOM' },
      { id: 41, nombre: 'Baños y Cocinas', codigo: 'BYC' },
      { id: 49, nombre: 'Pisos', codigo: 'PISO' },
      { id: 57, nombre: 'Maderas', codigo: 'MADE' },
      { id: 56, nombre: 'Aberturas', codigo: 'ABER' },
      { id: 43, nombre: 'Construcciones', codigo: 'CONS' }
    ]
  },
  {
    id: 3,
    nombre: 'DECO / CONFORT',
    jefe_email: 'adolfo.marchesi@easy.com.ar',
    jefe_nombre: 'Adolfo Marchesi',
    sector_ids: [16, 50, 12, 39, 64],
    sectores: [
      { id: 16, nombre: 'Menaje y Deco', codigo: 'DECO' },
      { id: 50, nombre: 'Iluminación', codigo: 'ILUM' },
      { id: 12, nombre: 'Deco Ventanas y Textil', codigo: 'VENT' },
      { id: 39, nombre: 'Electro', codigo: 'ELTR' },
      { id: 64, nombre: 'Ampolletas', codigo: 'AMPO' }
    ]
  },
  {
    id: 4,
    nombre: 'HOGAR / AIRE LIBRE',
    jefe_email: 'miguel.valdora@easy.com.ar',
    jefe_nombre: 'Miguel Valdora',
    sector_ids: [47, 23, 59, 53],
    sectores: [
      { id: 47, nombre: 'Muebles', codigo: 'MUEB' },
      { id: 23, nombre: 'Outdoor', codigo: 'OUTD' },
      { id: 59, nombre: 'Organizadores', codigo: 'ORGA' },
      { id: 53, nombre: 'Jardín y Mascotas', codigo: 'JARD' }
    ]
  }
];

export const ALL_SECTORS = STORE_BLOCKS.flatMap(b => b.sectores);

export function getBlockBySectorId(sectorId) {
  const sId = Number(sectorId);
  return STORE_BLOCKS.find(b => b.sector_ids.includes(sId)) || STORE_BLOCKS[0];
}

export function getSectorName(sectorId) {
  const sId = Number(sectorId);
  const found = ALL_SECTORS.find(s => s.id === sId);
  if (found) return found.nombre;
  if (sId === 1) return 'Herramientas';
  return `Sector ${sId}`;
}
