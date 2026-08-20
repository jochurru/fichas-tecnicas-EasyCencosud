import dotenv from 'dotenv';

dotenv.config();

/**
 * Limpia y parsea texto JSON de las respuestas del modelo, incluso si viene envuelto en markdown.
 */
function cleanAndParseJson(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  }
  return JSON.parse(cleaned);
}

/**
 * Llama a la API de Gemini (Proveedor principal).
 */
async function fetchFromGemini(descripcion, proveedor, grupoArticulos) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'TU_API_KEY_DE_GEMINI') {
    throw new Error('GEMINI_API_KEY no está configurada.');
  }

  const promptText = `Eres un experto técnico en ferretería y retail. Analiza este producto del catálogo SAP de Easy Cencosud y genera su ficha técnica estructurada con especificaciones técnicas estándar.
  
Detalles SAP del producto:
- Descripción SAP: ${descripcion}
- Proveedor / CUIT: ${proveedor}
- Grupo de artículos: ${grupoArticulos || 'No especificado'}

REGLAS DE ESTANDARIZACIÓN CRÍTICAS:
1. Debes devolver EXACTAMENTE 5 especificaciones técnicas en la lista "especificaciones". Ni más ni menos.
2. Para herramientas eléctricas o a batería, prioriza en este orden exacto:
   - Voltaje (ej: "12V", "20V MAX") o Potencia (ej: "750 W")
   - Velocidad (ej: "0 - 1500 RPM")
   - Mandril / Encastre (ej: "1/4 pulgada", "13 mm")
   - Torque Máximo (ej: "30 Nm", "N/A" si no aplica)
   - Batería / Alimentación (ej: "Litio-Ion 1.5 Ah", "Batería integrada" o "Cable 2m")
3. Para accesorios, consumibles y herramientas manuales (ej: discos, grapas, brocas), prioriza:
   - Medida / Diámetro (ej: "1/2 pulgada", "115 mm")
   - Material (ej: "Acero HSS", "Cromo Vanadio")
   - Cantidad / Presentación (ej: "1000 unidades", "Blister x 1")
   - Compatibilidad / Uso (ej: "Para amoladoras", "Madera y metal")
   - Peso o Espesor (ej: "1.2 mm", "0.45 kg")
4. Si un valor no está explícito en la descripción breve de SAP, realiza una deducción realista en base a la marca (ej: Bosch, Makita, DeWalt, Stanley) y el tipo de herramienta. Si no se puede deducir, usa "N/A". No dejes campos vacíos ni devuelvas menos de 5 especificaciones.
5. CONVERSIÓN DE MEDIDAS (PULGADAS A MILÍMETROS): Si un valor de medida (como diámetro de disco, mechas o tamaño de mandril/encastre) está originalmente en pulgadas (ej: "3/8 pulgadas", "1/2 pulgada", "1/2\"", "1/4\""), debes convertirlo obligatoriamente a milímetros bajo los estándares de ferretería (ej: "1/4\"" -> "6 mm" o "6.35 mm", "3/8\"" -> "10 mm", "1/2\"" -> "13 mm", "7-1/4\"" -> "184 mm", "4-1/2\"" -> "115 mm", etc.) y expresarlo únicamente en milímetros (mm).

Devuelve ÚNICAMENTE un JSON válido que siga exactamente esta estructura:
{
  "marca": "string",
  "tipo_herramienta": "string",
  "especificaciones": [
    { "clave": "string", "valor": "string" },
    { "clave": "string", "valor": "string" },
    { "clave": "string", "valor": "string" },
    { "clave": "string", "valor": "string" },
    { "clave": "string", "valor": "string" }
  ],
  "sugerencia_busqueda_imagen": "string"
}`;

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: promptText }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.error?.message || JSON.stringify(data);
    throw new Error(`HTTP ${response.status}: ${errorMsg}`);
  }

  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error('Respuesta de Gemini vacía.');
  }

  return cleanAndParseJson(textContent);
}

/**
 * Llama a la API de Groq (Proveedor de respaldo / Fallback).
 */
async function fetchFromGroq(descripcion, proveedor, grupoArticulos) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY no está configurada.');
  }

  const promptText = `Eres un experto técnico en ferretería y retail. Analiza este producto del catálogo SAP de Easy Cencosud y genera su ficha técnica estructurada con especificaciones técnicas estándar.
  
Detalles SAP del producto:
- Descripción SAP: ${descripcion}
- Proveedor / CUIT: ${proveedor}
- Grupo de artículos: ${grupoArticulos || 'No especificado'}

REGLAS DE ESTANDARIZACIÓN CRÍTICAS:
1. Debes devolver EXACTAMENTE 5 especificaciones técnicas en la lista "especificaciones". Ni más ni menos.
2. Para herramientas eléctricas o a batería, prioriza en este orden exacto:
   - Voltaje (ej: "12V", "20V MAX") o Potencia (ej: "750 W")
   - Velocidad (ej: "0 - 1500 RPM")
   - Mandril / Encastre (ej: "1/4 pulgada", "13 mm")
   - Torque Máximo (ej: "30 Nm", "N/A" si no aplica)
   - Batería / Alimentación (ej: "Litio-Ion 1.5 Ah", "Batería integrada" o "Cable 2m")
3. Para accesorios, consumibles y herramientas manuales (ej: discos, grapas, brocas), prioriza:
   - Medida / Diámetro (ej: "1/2 pulgada", "115 mm")
   - Material (ej: "Acero HSS", "Cromo Vanadio")
   - Cantidad / Presentación (ej: "1000 unidades", "Blister x 1")
   - Compatibilidad / Uso (ej: "Para amoladoras", "Madera y metal")
   - Peso o Espesor (ej: "1.2 mm", "0.45 kg")
4. Si un valor no está explícito en la descripción breve de SAP, realiza una deducción realista en base a la marca (ej: Bosch, Makita, DeWalt, Stanley) y el tipo de herramienta. Si no se puede deducir, usa "N/A". No dejes campos vacíos ni devuelvas menos de 5 especificaciones.
5. CONVERSIÓN DE MEDIDAS (PULGADAS A MILÍMETROS): Si un valor de medida (como diámetro de disco, mechas o tamaño de mandril/encastre) está originalmente en pulgadas (ej: "3/8 pulgadas", "1/2 pulgada", "1/2\"", "1/4\""), debes convertirlo obligatoriamente a milímetros bajo los estándares de ferretería (ej: "1/4\"" -> "6 mm" o "6.35 mm", "3/8\"" -> "10 mm", "1/2\"" -> "13 mm", "7-1/4\"" -> "184 mm", "4-1/2\"" -> "115 mm", etc.) y expresarlo únicamente en milímetros (mm).

Devuelve ÚNICAMENTE un JSON válido que siga exactamente esta estructura:
{
  "marca": "string",
  "tipo_herramienta": "string",
  "especificaciones": [
    { "clave": "string", "valor": "string" },
    { "clave": "string", "valor": "string" },
    { "clave": "string", "valor": "string" },
    { "clave": "string", "valor": "string" },
    { "clave": "string", "valor": "string" }
  ],
  "sugerencia_busqueda_imagen": "string"
}`;

  const url = "https://api.groq.com/openai/v1/chat/completions";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "groq/compound-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: promptText
        }
      ]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.error?.message || JSON.stringify(data);
    throw new Error(`HTTP ${response.status}: ${errorMsg}`);
  }

  const textContent = data.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new Error('Respuesta de Groq vacía.');
  }

  return cleanAndParseJson(textContent);
}

/**
 * Invoca a la API de Gemini (Principal) o a Groq (Fallback) para extraer
 * y enriquecer las especificaciones técnicas de un producto.
 */
export async function extractSpecifications(descripcion, proveedor, grupoArticulos) {
  try {
    console.log('[Extractor] Intentando extracción con Gemini (3.5 Flash Lite)...');
    const result = await fetchFromGemini(descripcion, proveedor, grupoArticulos);
    console.log('[Extractor] ✓ Éxito con Gemini');
    return result;
  } catch (geminiError) {
    console.warn(`[Extractor] ⚠️ Gemini falló (${geminiError.message}). Iniciando fallback con Groq (compound-mini)...`);
    
    try {
      const result = await fetchFromGroq(descripcion, proveedor, grupoArticulos);
      console.log('[Extractor] ✓ Éxito con Groq (Fallback)');
      return result;
    } catch (groqError) {
      console.error('[Extractor] ❌ Falló también el motor de Groq:', groqError.message);
      throw new Error(`Ambos motores fallaron. Gemini: ${geminiError.message}. Groq: ${groqError.message}`);
    }
  }
}
