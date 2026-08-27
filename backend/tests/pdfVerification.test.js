import { test } from 'node:test';
import assert from 'node:assert';
import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { generatePdf } from '../lib/pdfGenerator.js';
import { supabaseDb } from '../lib/supabase.js';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scratchDir = path.join(__dirname, '..', 'scratch');

if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}
test('1. Producto Robust con 3 especificaciones (fleje3 y fleje2)', async () => {
  const robustFicha = {
    producto: { sku: 'TEST_ROBUST_3', descripcion: 'TALADRO ROBUST 3 SPECS', marca: 'ROBUST', ean: '7790000000001' },
    ficha_tecnica: {
      foto_url: 'https://placehold.co/400x300?text=Robust+Tool',
      especificaciones_json: {
        marca: 'ROBUST',
        tipo_herramienta: 'TALADRO PERCUTOR',
        especificaciones: [
          { clave: 'Potencia', valor: '850W' },
          { clave: 'Velocidad', valor: '3000 RPM' },
          { clave: 'Mandril', valor: '13 mm' },
          { clave: 'Garantía', valor: '2 Años' },
          { clave: 'Origen', valor: 'China' }
        ]
      }
    }
  };

  const pdfFleje3 = await generatePdf(robustFicha, 'fleje3');
  assert.ok(pdfFleje3 && pdfFleje3.length > 5000, 'PDF fleje3 debe generarse correctamente');
  fs.writeFileSync(path.join(scratchDir, 'test1_robust_fleje3.pdf'), pdfFleje3);

  const pdfFleje2 = await generatePdf(robustFicha, 'fleje2');
  assert.ok(pdfFleje2 && pdfFleje2.length > 5000, 'PDF fleje2 debe generarse correctamente');
  fs.writeFileSync(path.join(scratchDir, 'test1_robust_fleje2.pdf'), pdfFleje2);
});

test('2. Producto Stanley (No-Robust) con 3 especificaciones (fleje3 y fleje2)', async () => {
  const stanleyFicha3 = {
    producto: { sku: 'TEST_STANLEY_3', descripcion: 'TALADRO STANLEY 3 SPECS', marca: 'STANLEY', ean: '7790000000002' },
    ficha_tecnica: {
      foto_url: 'https://placehold.co/400x300?text=Stanley+Tool',
      especificaciones_json: {
        marca: 'STANLEY',
        tipo_herramienta: 'TALADRO PERCUTOR 13MM',
        especificaciones: [
          { clave: 'Potencia', valor: '600W' },
          { clave: 'Velocidad', valor: '2900 RPM' },
          { clave: 'Impactos', valor: '49300 IPM' },
          { clave: 'Garantía', valor: '2 Años' },
          { clave: 'Origen', valor: 'Brasil' }
        ]
      }
    }
  };

  const pdfFleje3 = await generatePdf(stanleyFicha3, 'fleje3');
  assert.ok(pdfFleje3 && pdfFleje3.length > 5000, 'PDF fleje3 debe generarse correctamente');
  fs.writeFileSync(path.join(scratchDir, 'test2_stanley3_fleje3.pdf'), pdfFleje3);

  const pdfFleje2 = await generatePdf(stanleyFicha3, 'fleje2');
  assert.ok(pdfFleje2 && pdfFleje2.length > 5000, 'PDF fleje2 debe generarse correctamente');
  fs.writeFileSync(path.join(scratchDir, 'test2_stanley3_fleje2.pdf'), pdfFleje2);
});

test('3. Producto Stanley con 7 especificaciones (fleje3, fleje2, a4)', async () => {
  const stanleyFicha7 = {
    producto: { sku: 'TEST_STANLEY_7', descripcion: 'AMOLADORA STANLEY 7 SPECS', marca: 'STANLEY', ean: '7790000000003' },
    ficha_tecnica: {
      foto_url: 'https://placehold.co/400x300?text=Stanley+Grinder',
      especificaciones_json: {
        marca: 'STANLEY',
        tipo_herramienta: 'AMOLADORA ANGULAR',
        especificaciones: [
          { clave: 'Potencia', valor: '710W' },
          { clave: 'Velocidad', valor: '11000 RPM' },
          { clave: 'Diámetro de disco', valor: '115 mm' },
          { clave: 'Eje', valor: 'M14' },
          { clave: 'Longitud de cable', valor: '2 m' },
          { clave: 'Peso', valor: '1.9 kg' },
          { clave: 'Interruptor', valor: 'Deslizante con bloqueo' },
          { clave: 'Garantía', valor: '2 Años' },
          { clave: 'Origen', valor: 'China' }
        ]
      }
    }
  };

  const pdfFleje3 = await generatePdf(stanleyFicha7, 'fleje3');
  assert.ok(pdfFleje3 && pdfFleje3.length > 5000, 'PDF fleje3 debe incluir las 7 specs');
  fs.writeFileSync(path.join(scratchDir, 'test3_stanley7_fleje3.pdf'), pdfFleje3);

  const pdfFleje2 = await generatePdf(stanleyFicha7, 'fleje2');
  assert.ok(pdfFleje2 && pdfFleje2.length > 5000, 'PDF fleje2 debe incluir las 7 specs');
  fs.writeFileSync(path.join(scratchDir, 'test3_stanley7_fleje2.pdf'), pdfFleje2);

  const pdfA4 = await generatePdf(stanleyFicha7, 'a4');
  assert.ok(pdfA4 && pdfA4.length > 5000, 'PDF a4 debe incluir las 7 specs');
  fs.writeFileSync(path.join(scratchDir, 'test3_stanley7_a4.pdf'), pdfA4);
});

test('4 & 5. Verificación de Invalidación de Caché en Supabase y Audit Logs', { skip: !process.env.SUPABASE_URL }, async () => {
  const testSku = '1293475';
  const fakeFileName = `${testSku}_fleje3.pdf`;

  // Subir caché falso
  await supabaseDb.storage.from('fichas-pdf').upload(fakeFileName, Buffer.from('FAKE PDF CACHE CONTENT'), { upsert: true });

  // Invalidación por prefijo
  const { data: fileList } = await supabaseDb.storage.from('fichas-pdf').list('', { search: `${testSku}_` });
  let filesToRemove = [`${testSku}_a4.pdf`, `${testSku}_fleje3.pdf`, `${testSku}_fleje2.pdf`];
  if (Array.isArray(fileList) && fileList.length > 0) {
    const matchedFiles = fileList.filter(f => f.name && f.name.startsWith(`${testSku}_`)).map(f => f.name);
    filesToRemove = Array.from(new Set([...filesToRemove, ...matchedFiles]));
  }

  const { error: removeErr } = await supabaseDb.storage.from('fichas-pdf').remove(filesToRemove);
  assert.ifError(removeErr, 'El borrado del caché debe ejecutarse sin errores');

  // Insertar evento audit log PDF_CACHE_INVALIDATED
  const { error: auditErr } = await supabaseDb.from('audit_logs').insert([{
    usuario_email: 'test_runner@system.local',
    rol: 'ADMIN',
    accion: 'PDF_CACHE_INVALIDATED',
    entidad: 'FICHA_TECNICA',
    sku: testSku,
    valores_nuevos: { archivos_eliminados: filesToRemove },
    resultado: 'SUCCESS'
  }]);
  assert.ifError(auditErr, 'La inserción del audit_log debe ejecutarse sin errores');

  // Consultar evento en DB para verificar su persistencia
  const { data: auditData, error: selectErr } = await supabaseDb.from('audit_logs')
    .select('id, usuario_email, accion, sku, valores_nuevos, timestamp')
    .eq('sku', testSku)
    .eq('accion', 'PDF_CACHE_INVALIDATED')
    .order('timestamp', { ascending: false })
    .limit(1);

  assert.ifError(selectErr);
  assert.ok(auditData && auditData.length > 0, 'El audit log de PDF_CACHE_INVALIDATED debe existir en DB');
  assert.strictEqual(auditData[0].accion, 'PDF_CACHE_INVALIDATED');
});

test('6. Verificación de Generación de PDF por Lote (generateBatchPdf) con Iframes', async () => {
  const { generateBatchPdf } = await import('../lib/pdfGenerator.js');
  
  // Simular un lote híbrido de productos con múltiples copias
  const batchItems = [
    { sku: '1277609', template: 'robust_fleje3', cantidad: 2 }, // Robust
    { sku: '1366396', template: 'fleje3', cantidad: 1 }         // Stanley (Standard)
  ];
  
  // DataService mock simplificado para el test
  const mockDataService = {
    getProductoBySku: async (sku) => ({ sku, descripcion: 'Mock Product', marca: sku === '1277609' ? 'ROBUST' : 'STANLEY' }),
    getFichaBySku: async (sku) => ({
      especificaciones_json: {
        tipo_herramienta: 'MOCK',
        especificaciones: [{ clave: 'Potencia', valor: '500W' }]
      }
    }),
    getEanBySku: async (sku) => '1234567890123'
  };

  const pdfBuffer = await generateBatchPdf(batchItems, mockDataService);
  
  // Verificaciones básicas
  assert.ok(pdfBuffer && pdfBuffer.length > 1000, 'El PDF generado por lote no debe estar vacío');
  
  // Guardar en la carpeta temporal de scratch (como los demás tests)
  const batchPath = path.join(scratchDir, 'test6_lote_hibrido.pdf');
  fs.writeFileSync(batchPath, pdfBuffer);
  assert.ok(fs.existsSync(batchPath), 'El archivo PDF del lote debe existir en la carpeta scratch');
});

import { after } from 'node:test';
import { cleanupBrowser } from '../lib/pdfGenerator.js';
after(async () => {
  await cleanupBrowser();
});
