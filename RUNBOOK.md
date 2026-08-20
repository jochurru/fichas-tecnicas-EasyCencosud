# Manual de Operación, Despliegue y Resolución de Problemas (Runbook & Troubleshooting)

Este manual documenta cómo ejecutar localmente, desplegar a producción y resolver incidencias comunes de la plataforma de Fichas Técnicas.

---

## 🚀 1. Ejecución en Entorno Local (Desarrollo)

### Requisitos Previos
*   **Node.js:** Versión 18 o superior instalada.
*   **Firebase CLI:** Instalado globalmente (`npm install -g firebase-tools`).

### Configuración de Variables de Entorno (`.env`)
En la carpeta `/backend/` debe existir un archivo `.env` con las siguientes credenciales:
```env
PORT=3000
SUPABASE_URL=https://<id-proyecto>.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (Service Role Key para omitir RLS)
GEMINI_API_KEY=AIzaSy... (API Key de Google Gemini Pro)
ADMIN_PASSWORD=EasyIT2026!
```

### Ejecución Paso a Paso
1.  **Iniciar el Backend:**
    ```bash
    cd backend
    npm install
    npm run dev
    ```
    *El servidor iniciará en http://localhost:3000. Nodemon recargará ante cualquier cambio.*
2.  **Iniciar el Frontend:**
    ```bash
    cd mobile
    npm install
    npm run dev
    ```
    *El cliente React iniciará en http://localhost:5173.*

---

## ☁️ 2. Guía de Despliegue a Producción

### Despliegue del Frontend (Firebase Hosting)
El cliente se compila y se despliega directamente en el CDN de Firebase:
```bash
cd mobile
npm run build
npx firebase deploy --only hosting --project fichastecnicas-abdb5
```

### Despliegue del Backend (Google Cloud Run)
El backend se compila en un contenedor Docker y se despliega en Google Cloud Run a través de disparadores automáticos de Git:
1.  Realizar un commit a la rama principal:
    ```bash
    git add .
    git commit -m "feat: descripción de tu cambio"
    git push origin main
    ```
2.  **Google Cloud Build** interceptará el push automáticamente, compilará la imagen de Docker usando el archivo de configuración del repositorio y desplegará la revisión en Cloud Run en menos de 2 minutos.

---

## 🔍 3. Resolución de Problemas Comunes (Troubleshooting)

### A. El login local da un error 500 o error de conexión con el backend
*   **Síntoma:** Intentas loguearte en tu máquina de desarrollo local y la consola de Chrome muestra un error de conexión o estado 500 al llamar a `/api/auth/login`.
*   **Causa:** En sistemas Windows, Vite a veces intenta resolver `localhost` a la dirección IPv6 `::1`, mientras que Node.js por defecto escucha en la dirección IPv4 `127.0.0.1`.
*   **Solución:** Modificar `mobile/vite.config.js` y forzar el target del proxy a la IPv4 explícita:
    ```javascript
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
    ```

### B. El buscador de productos retorna arrays vacíos o error 404 para SKUs que existen
*   **Síntoma:** Al buscar un SKU en la app, dice "Producto no encontrado", pero al revisar la base de datos de Supabase, el producto está cargado.
*   **Causa:** Las políticas de seguridad a nivel de registro (RLS) en Supabase impiden que usuarios no autorizados (o con tokens JWT de bajos privilegios) lean la tabla `productos` o `ficha_tecnica`.
*   **Solución:** Asegurar que el backend utilice el cliente `supabaseDb` inicializado con la **Service Role Key** (la cual salta las políticas RLS) para realizar las búsquedas de productos de pasillo, manteniendo la seguridad RLS únicamente para flujos de autenticación de clientes directos.

### C. Error de memoria en Cloud Run al imprimir (OOM / Puppeteer Crash)
*   **Síntoma:** El backend de Cloud Run se reinicia de forma inesperada o las peticiones de descarga de PDF devuelven `502 Bad Gateway` tras unos segundos de espera.
*   **Causa:** Puppeteer ejecuta una instancia completa de Chromium sin interfaz gráfica. Levantar múltiples navegadores en simultáneo consume mucha memoria RAM, lo que hace que Cloud Run (cuyo límite por defecto es 512MB o 1GB) mate el proceso por exceso de memoria (Out Of Memory).
*   **Solución:** 
    1.  Asegurar que la **Caché de PDFs en Supabase Storage** esté activa. Esto reduce el número de ejecuciones de Puppeteer a una sola vez por SKU modificado.
    2.  Ingresar a la consola de Google Cloud Platform y subir la memoria asignada al servicio de Cloud Run de `512MB` a **`2GB`**.

### D. La sesión no expira o da errores raros tras expirar el token
*   **Síntoma:** El token JWT vence (por defecto a la hora), pero la aplicación sigue mostrando el editor. Al intentar guardar o imprimir, tira errores genéricos de conexión del servidor.
*   **Causa:** El cliente React mantiene guardado el token viejo y vencido en memoria y lo sigue enviando en la cabecera `Authorization`. El backend rechaza la petición con `401 Unauthorized`.
*   **Solución:** Asegurar que el cliente capture los errores de estado `401`/`403` en todas las llamadas fetch (búsqueda, guardado e impresión) y ejecute un logout inmediato que limpie el `localStorage` y recargue la página.

### E. Errores al cargar planillas Excel muy grandes de SAP
*   **Síntoma:** Al subir planillas SAP pesadas con miles de filas, el navegador se queda esperando y luego devuelve error de Timeout de red.
*   **Causa:** El procesamiento síncrono bloquea el hilo de ejecución de Express por más de 60 segundos (tiempo límite de conexiones en Cloud Run).
*   **Solución:** Asegurar que el endpoint `/api/catalogos/importar` devuelva inmediatamente un `taskId` con código `202 Accepted` y procese la información usando `setImmediate()` o colas en segundo plano, permitiendo que la interfaz consulte el progreso a través de `/api/catalogos/tareas/:id`.
