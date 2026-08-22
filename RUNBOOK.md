# Manual de Operación, Despliegue y Resolución de Problemas (Runbook & Troubleshooting)

Este manual documenta cómo ejecutar localmente, desplegar a producción y resolver incidencias comunes de la plataforma de Fichas Técnicas.

---

## 🚀 1. Ejecución en Entorno Local (Desarrollo)

### Requisitos Previos
*   **Node.js:** Versión 18 o superior instalada.
*   **Firebase CLI:** Instalado globalmente (`npm install -g firebase-tools`).

### Configuración de Variables de Entorno (`.env`)
En la carpeta `/backend/` debe existir un archivo `.env` con las siguientes credenciales (ver `.env.example` como referencia):
```env
PORT=3000
SUPABASE_URL=https://<id-proyecto>.supabase.co
SUPABASE_KEY=<su-service-role-key-para-bypass-de-rls>
GEMINI_API_KEY=<su-api-key-de-google-gemini-pro>
JWT_SECRET=<su-clave-secreta-jwt>
ADMIN_PASSWORD=<su-contrasena-de-contingencia-admin>
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

### F. Fallos de validación Zod en peticiones (Error 400 - Error de Validación)
*   **Síntoma:** El cliente React recibe un error HTTP 400 indicando incompatibilidad de campos o dominio no permitido.
*   **Causa:** Se ha integrado un middleware de validación estricta en el backend para prevenir cargas maliciosas o inyecciones en parámetros SKU, EAN o esquemas JSON.
*   **Solución:** Asegurar que los correos de ingreso correspondan a los dominios institucionales (`@easy.com.ar` o `@cencosud.com.ar`) y que los SKUs/EANs no contengan caracteres especiales inyectables.

### G. Monitoreo de Auditoría y Trazabilidad
*   **Logs de Auditoría:** Consulta la tabla `audit_logs` en Supabase para trazar actividades críticas (búsquedas, impresiones, ingresos):
    ```sql
    SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100;
    ```
*   **Historial de Cambios (Versionado):** Consulta la tabla `fichas_historial` para comparar versiones previas de especificaciones técnicas:
    ```sql
    SELECT version, especificaciones_json, modificado_por FROM fichas_historial WHERE sku = '1367504' ORDER BY version DESC;
    ```

### H. Alerta: Falta logotipo oficial de la marca / completitud menor al 100%
*   **Síntoma:** Al editar la ficha técnica, la barra de completitud no sube del 95% y se lee la alerta `"Falta registrar el logotipo oficial para la marca."`
*   **Causa:** Se introdujo una regla de calidad donde la marca otorga un 15% del score (10% por el nombre y 5% por el logo). Si la marca no tiene un logotipo registrado estáticamente en `brandLogoMap` o dinámicamente en la tabla de Supabase `marcas`, se restará el 5% y saltará la alerta.
*   **Solución:** Si tienes rol de Administrador o Coordinador, arrastra o sube el logotipo WebP correspondiente utilizando el widget en la pantalla principal del editor de fichas. Al subirse, la alerta se desactivará automáticamente.

### I. El botón de vaciar cola de impresión en móviles no da respuesta
*   **Síntoma:** Presionas el botón para vaciar la cola de impresión y no responde o se queda colgado.
*   **Causa:** Previamente se utilizaba un diálogo nativo bloqueante `window.confirm`. Si el navegador bloquea las ventanas emergentes o los permisos de vibración háptica fallan, la interfaz no responde.
*   **Solución:** El botón ahora utiliza la API local `IndexedDB` y responde de forma no bloqueante con un Toast flotante autocerrable y una vibración háptica corta (`navigator.vibrate(40)`). Asegura que el navegador soporte IndexedDB y no esté en modo navegación privada ultra restrictiva.

### J. La primera página de la cola de impresión A4 se ve diferente a las siguientes
*   **Síntoma:** Al generar el PDF masivo con la cola de impresión en tamaño A4, la primera página respeta el diseño pero las siguientes desplazan los textos o quedan recortadas.
*   **Causa:** Estilos CSS asimétricos o reglas `@page` y márgenes forzados de Puppeteer que no se alinean correctamente entre páginas continuas.
*   **Solución:** Asegurar que el backend mantenga las plantillas HTML (`template_a4.html`) utilizando la regla `page-break-after: always;` para cada ficha encolada de manera limpia y sin anidar contenedores con estilos flexbox rotos que desborden los límites físicos del papel.
