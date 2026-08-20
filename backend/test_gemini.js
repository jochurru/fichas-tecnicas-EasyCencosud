import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ ERROR: GEMINI_API_KEY no encontrada en .env");
  process.exit(1);
}

async function testExtractor() {
  console.log("⏳ Contactando a Gemini API...");

  const productoEjemplo = {
    sku: "148135",
    descripcion: "GRAPAS (CAJA) 1/2\" 69-548 STANLEY",
    proveedor: "Black & decker argentina s.a.",
    grupo_articulos: "450608001"
  };

  const promptText = `Eres un experto técnico en ferretería y retail. Analiza este producto y extrae sus especificaciones:
- SKU: ${productoEjemplo.sku}
- Descripción SAP: ${productoEjemplo.descripcion}
- Proveedor: ${productoEjemplo.proveedor}
- Grupo de artículos: ${productoEjemplo.grupo_articulos}

Devuelve ÚNICAMENTE un JSON válido con la siguiente estructura:
{
  "marca": "string",
  "tipo_herramienta": "string",
  "especificaciones": [
    { "clave": "string", "valor": "string" }
  ],
  "sugerencia_busqueda_imagen": "string"
}`;

  try {
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
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }

    const textContent = data.candidates[0].content.parts[0].text;
    console.log("\n✅ ¡Respuesta exitosa de Gemini!");
    console.log(JSON.stringify(JSON.parse(textContent), null, 2));

  } catch (error) {
    console.error("\n❌ Error en la llamada a Gemini:", error.message);
  }
}

testExtractor();
