# Fichas Técnicas Easy Cencosud (Góndolas & Salón de Ventas)

Aplicación web móvil corporativa (PWA) diseñada para optimizar los procesos de búsqueda, validación, edición y generación en PDF de fichas técnicas de productos y cartelas de góndola (flejes) para las tiendas **Easy** del grupo **Cencosud**.

---

## 🏗️ Arquitectura de la Solución

El sistema sigue una arquitectura desacoplada moderna y 100% serverless, ideal para optimizar costos de infraestructura y escalar de forma transparente ante picos de demanda en los locales comerciales.

```mermaid
graph TD
    Client[Frontend: React PWA + Tailwind + Vite] -- "HTTPS / JWT" --> API[Backend: Node.js + Express en Google Cloud Run]
    API -- "Supabase Client (Bypass RLS)" --> DB[(PostgreSQL en Supabase)]
    API -- "Puppeteer (Headless Chrome)" --> PDF[Generación de PDF en Caliente]
    API -- "Caché de PDFs" --> Bucket[Supabase Storage: fichas-pdf]
    API -- "Imágenes y Logos (WebP)" --> CatalogBucket[Supabase Storage: imagenes-catalogo]
    SSO[Azure AD / Entra ID] -.-> Login[Ingreso SSO-Ready / Supabase Auth]
```

### Componentes de la Arquitectura
1.  **Frontend (React Client - Firebase Hosting):**
    *   Compilado como una **PWA (Progressive Web App)** con soporte offline mediante Service Workers.
    *   Utiliza la API `HTML5 IndexedDB` local en el celular para almacenar las búsquedas exitosas, mantener la cola de impresión temporal y permitir la visualización offline de fichas en zonas ciegas de Wi-Fi del salón.
2.  **Backend (API Server - Google Cloud Run):**
    *   Una API REST desarrollada en Node.js y Express empaquetada en un contenedor Docker.
    *   Realiza procesamiento de compresión en caliente mediante Canvas a formato WebP para fotos de productos y marcas subidas por operadores autorizados.
    *   Utiliza Puppeteer (Headless Chrome) para la renderización matemática exacta de los PDFs a partir de plantillas HTML y CSS diseñadas a escala real de impresión (`A4`, `90x74mm` y `80x40mm`), garantizando alineación de estilos entre páginas en impresiones masivas.
3.  **Repositorio de Medios y CDN (Supabase Storage):**
    *   `fichas-pdf`: Implementa una estrategia *Cache-Aside* para evitar la saturación de CPU que provoca levantar múltiples procesos Chrome. Las descargas de PDFs pre-generados se sirven de manera directa en `<50ms`.
    *   `imagenes-catalogo`: Contenedor público para almacenar fotos de productos (indexadas por SKU) y logotipos de marcas comerciales (indexadas por slug) cargadas de forma dinámica.
4.  **Capa de Datos y Autenticación (Supabase PostgreSQL):**
    *   Almacena las especificaciones de SAP, las fichas aprobadas locales, la tabla dinámica de `marcas` y los mapeos de códigos de barra (EAN).
    *   Autenticación integrada via JWT para control de accesos.

---

## 🌟 Características Principales

*   **Buscador Multimodal:** Permite escanear códigos de barra directamente con la cámara del celular del operador (librería `html5-qrcode`) o escribir manualmente el SKU/EAN.
*   **Enriquecimiento con Gemini AI:** Si el producto consultado existe en SAP pero no tiene ficha técnica creada, el backend invoca a Gemini Pro en tiempo real para estructurar las especificaciones técnicas del texto del producto de SAP de manera estructurada en JSON.
*   **Gestión Dinámica de Logos e Imágenes:** Los administradores y coordinadores pueden arrastrar y cargar fotos de productos o marcas directamente desde la pantalla de edición del producto. Las imágenes se procesan localmente vía Canvas en WebP para ahorrar ancho de banda y almacenamiento antes de ser subidas a Supabase Storage.
*   **Auditoría y Alertas de Calidad (Completitud):** Evaluador inteligente en tiempo real que mide la completitud de la ficha (SKU 15%, EAN 15%, Marca 10%, Logo 5%, Foto 20%, Descripción 15%, Especificaciones 20%) y alerta al operador sobre inconsistencias como la falta de código de barras o logotipo corporativo no registrado.
*   **Cola de Impresión Avanzada (Batch Printing):** Permite encolar múltiples fichas en IndexedDB local, previsualizarlas en lote, vaciar la cola con feedback háptico suave (`vibrate`) y generar un único PDF de impresión A4 continuo con estilos unificados y paginación homogénea.
*   **Diseño e Impresión Centrada (Anti-Recortes):** Todas las plantillas se generan en tamaño A4 con guías punteadas de corte y márgenes seguros de `15mm` para evitar que los rodillos de las impresoras físicas recorten logotipos o textos.
*   **Control de Roles de 3 Niveles (RBAC):**
    *   *Administrador:* Acceso a carga masiva SAP y configuraciones generales de marcas y catálogos.
    *   *Coordinador de Cartelería:* Permisos para editar atributos, cargar fotos y marcas, y aprobar fichas técnicas locales.
    *   *Operador de Pasillo:* Búsqueda, visualización y envío a impresión rápida (sin privilegios de edición).
*   **Carga Asíncrona SAP:** Ingestión de planillas Excel de SAP procesadas en segundo plano con una barra de progreso dinámico en tiempo real para evitar caídas por timeouts.

---

## 🛠️ Tecnologías y Dependencias

### Frontend
*   **Vite + React (JS):** Entorno de ejecución rápido y empaquetado.
*   **Tailwind CSS:** Diseño UI móvil responsivo siguiendo el branding corporativo de Easy.
*   **Vite-Plugin-PWA:** Generación de Service Workers para soporte offline.
*   **Lucide-React:** Set de iconos vectoriales.
*   **HTML5 QR Code:** Escaneo de códigos de barra desde el navegador móvil.

### Backend
*   **Node.js + Express:** API Servidora robusta y ligera.
*   **Puppeteer:** Compilación exacta de HTML a formato PDF PDF/A-1a.
*   **Supabase JS Client:** Comunicación con la base de datos PostgreSQL, Supabase Auth y Storage.
*   **XLSX (SheetJS):** Lectura veloz de reportes de logística SAP en formato Excel.
*   **Helmet & Express Rate Limit:** Protección contra inundaciones de red, inyecciones de código y fuerza bruta.

---

## 📁 Estructura del Repositorio

## 📁 Estructura Modularizada del Repositorio

```text
├── backend/
│   ├── assets/
│   │   └── sello_garantia_5_anos.png   # Imagen oficial del sello de 5 Años de Garantía
│   ├── lib/
│   │   ├── pdf/                        # 🧩 Módulos especializados del Generador de PDFs
│   │   │   ├── browserManager.js       # Singleton de Puppeteer Browser y reconexión activa
│   │   │   ├── templateLoader.js       # Resolutor de plantillas HTML (flejes, A4 y Robust)
│   │   │   ├── brandLogoProcessor.js   # Búsqueda DB/Storage, inversión SVG y escalado dinámico
│   │   │   └── specFormatter.js        # Detección eléctrica, pill 18V y sello oficial
│   │   ├── pdfGenerator.js             # Fachada ligera de generación de PDFs (<170 líneas)
│   │   ├── dataQuality.js              # Algoritmo de medición de completitud
│   │   ├── easyFetcher.js              # Extracción de catálogo público
│   │   ├── geminiExtractor.js          # Integración con Google Gemini AI Pro
│   │   └── supabase.js                 # Clientes Supabase Auth & Storage
│   ├── middlewares/
│   │   └── authMiddleware.js           # Validación JWT y control RBAC (Admin/Coord/Op)
│   ├── routes/
│   │   ├── catalogos.js                # Ingesta SAP, EANs y tareas asíncronas
│   │   ├── impresion.js                # Descarga y caché de PDFs
│   │   ├── productos.js                # Búsqueda, edición y aprobación de fichas
│   │   └── storage.js                  # Carga de marcas y subida WebP
│   ├── templates/                      # Plantillas HTML físicas real-scale
│   │   ├── template_robust_a4.html     # Plantilla A4 máster Robust
│   │   ├── template_robust_fleje_3.html# Plantilla Fleje 3 máster Robust (90x74mm)
│   │   ├── template_robust_fleje_2.html# Plantilla Fleje 2 máster Robust (80x40mm)
│   │   ├── template_standard_a4.html   # Plantilla A4 estándar
│   │   └── template_fleje_*.html       # Plantillas estándar de cartelería
│   └── index.js                        # Servidor Express de producción
└── mobile/
    ├── public/
    │   └── sello_garantia_5_anos.png   # Recurso estático del sello oficial de garantía
    └── src/
        ├── components/
        │   ├── admin/                  # 🧩 Módulos del Panel Administrativo
        │   │   ├── CatalogImportTab.jsx# Pestaña de Ingesta Excel SAP y progreso
        │   │   ├── EanImportTab.jsx    # Pestaña de Mapeo de Códigos EAN
        │   │   ├── QualityMetricsTab.jsx # Pestaña de Analítica de Calidad
        │   │   └── DynamicBrandsTab.jsx# Pestaña de Catálogo Dinámico de Marcas
        │   ├── editor/                 # 🧩 Módulos del Editor de Fichas
        │   │   ├── SpecsEditorList.jsx # Formulario dinámico de especificaciones
        │   │   └── ImageUploadSection.jsx # Compresión WebP en Canvas y vista previa
        │   ├── AdminPanel.jsx          # Modal contenedor ligero del panel admin (<220 líneas)
        │   ├── FichaEditor.jsx         # Orquestador del editor de producto
        │   ├── FichaPreviewModal.jsx   # Vista previa modal interactiva
        │   └── PrintQueueDrawer.jsx    # Cola de impresión batch en IndexedDB
```

---

## 👩‍💻 Guía para Desarrolladores y Mantenibilidad

El código ha sido refactorizado aplicando **Single Responsibility Principle (SRP)** y documentado exhaustivamente con **JSDoc**:

1. **Modificar el motor de PDFs**:
   - Para ajustar Puppeteer o agregar argumentos de Chromium, editar [`backend/lib/pdf/browserManager.js`](file:///c:/Users/Jonatan%20Churruarin/Desktop/Proyecto%20Fichas/backend/lib/pdf/browserManager.js).
   - Para cambiar lógica de logos, SVGs o colores corporativos, editar [`backend/lib/pdf/brandLogoProcessor.js`](file:///c:/Users/Jonatan%20Churruarin/Desktop/Proyecto%20Fichas/backend/lib/pdf/brandLogoProcessor.js).
   - Para modificar reglas de productos eléctricos o pills destacados, editar [`backend/lib/pdf/specFormatter.js`](file:///c:/Users/Jonatan%20Churruarin/Desktop/Proyecto%20Fichas/backend/lib/pdf/specFormatter.js).
2. **Modificar el Panel de Administración**:
   - Cada pestaña se encuentra totalmente desacoplada dentro de `mobile/src/components/admin/`. Se pueden agregar nuevas pestañas importándolas directamente en `AdminPanel.jsx`.
3. **Estándares de Documentación**:
   - Todas las funciones exportadas cuentan con firmas JSDoc indicando `@param`, `@returns` y descripción de excepciones `@throws`.

    │   │   ├── Scanner.jsx     # Escáner móvil integrado para cámara
    │   │   └── WelcomeLogin.jsx # Login corporativo / SSO-Ready
    │   ├── lib/
    │   │   └── indexedDb.js    # Capa de base de datos offline local del navegador
    │   ├── App.jsx             # Orquestador del flujo principal y estado offline
    │   └── main.jsx
    ├── vite.config.js          # Configuración de Vite, proxy local y PWA
    └── package.json
```
