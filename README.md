# Sistema de Fichas Técnicas y Cartelería de Producto

Aplicación web orientada a la **gestión, edición, validación y generación de fichas técnicas de producto y cartelería para punto de venta**.

La solución fue desarrollada como una PWA con arquitectura desacoplada, soporte móvil, funcionamiento offline, generación automatizada de PDFs, procesamiento de imágenes, control de roles e importación masiva de datos.

El objetivo del proyecto es reducir tareas manuales, estandarizar la información técnica de producto y agilizar la preparación de material listo para impresión.

---

## 🚀 Funcionalidades principales

- Búsqueda de productos por código interno o EAN
- Escaneo de códigos de barras desde dispositivos móviles
- Creación y edición de fichas técnicas
- Gestión de especificaciones técnicas
- Carga y procesamiento de imágenes de producto
- Gestión de logos y marcas
- Generación automática de PDFs
- Soporte para diferentes formatos de impresión
- Cola de impresión para múltiples fichas
- Importación masiva de datos desde archivos Excel
- Control de calidad y completitud de información
- Gestión de usuarios mediante roles
- Soporte offline mediante PWA e IndexedDB
- Integración de IA para estructuración de información técnica

---

## 🛠️ Stack tecnológico

### Frontend

![React](https://img.shields.io/badge/-React-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/-Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/-TailwindCSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

- React
- Vite
- Tailwind CSS
- Progressive Web App
- IndexedDB
- HTML5 QR Code
- Lucide React

### Backend

![Node.js](https://img.shields.io/badge/-Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/-Express-000000?style=flat&logo=express&logoColor=white)
![Supabase](https://img.shields.io/badge/-Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)

- Node.js
- Express
- Puppeteer
- Supabase
- PostgreSQL
- Supabase Storage
- XLSX / SheetJS
- Helmet
- Express Rate Limit

### Cloud e infraestructura

- Google Cloud Run
- Firebase Hosting
- Docker
- Google Cloud Build
- Supabase

---

## 🧱 Arquitectura

La solución está dividida en frontend, backend y servicios externos.

```text
Usuario
   │
   ▼
React PWA
   │
   ▼
API REST Node.js / Express
   │
   ├── Base de datos PostgreSQL
   ├── Almacenamiento de imágenes
   ├── Generación de PDFs
   ├── Importación de datos
   └── Servicios de IA
```

Esta separación permite mantener desacoplada la interfaz, la lógica de negocio y la persistencia de datos.

---

## 📱 Progressive Web App

El frontend fue diseñado como una PWA orientada principalmente al uso desde dispositivos móviles.

Entre sus características se incluyen:

- instalación desde navegador;
- soporte offline;
- almacenamiento local mediante IndexedDB;
- lectura de códigos de barras desde cámara;
- cola temporal de impresión;
- recuperación de búsquedas recientes;
- interfaz responsive.

---

## 🔎 Búsqueda y escaneo de productos

Los productos pueden localizarse mediante:

- código interno;
- EAN;
- escaneo de código de barras desde la cámara del dispositivo.

El objetivo es reducir el tiempo necesario para localizar información de producto durante tareas operativas.

---

## ✏️ Editor de fichas

El sistema permite editar y completar información técnica del producto desde una interfaz estructurada.

Incluye:

- descripción;
- especificaciones técnicas;
- marca;
- códigos de identificación;
- imagen de producto;
- logo de marca;
- atributos técnicos dinámicos.

Las especificaciones pueden agregarse, eliminarse y reorganizarse desde el editor.

---

## 🤖 Integración de IA

El backend incluye una integración con modelos de IA para ayudar a estructurar información técnica cuando los datos disponibles no se encuentran normalizados.

El flujo permite transformar descripciones de producto en información estructurada que posteriormente puede ser revisada y editada antes de su utilización.

La IA funciona como herramienta de asistencia y no reemplaza la validación del usuario.

---

## 🖼️ Gestión de imágenes

Las imágenes pueden cargarse desde la interfaz y procesarse antes de su almacenamiento.

El sistema contempla:

- imágenes de producto;
- logotipos de marca;
- conversión y optimización de archivos;
- almacenamiento centralizado;
- reutilización de recursos existentes.

Esto evita duplicaciones innecesarias y mejora los tiempos de carga.

---

## 📄 Generación de PDFs

Uno de los componentes principales del proyecto es el motor de generación de PDFs.

El backend utiliza Puppeteer para renderizar plantillas HTML y CSS diseñadas específicamente para impresión.

Se contemplan distintos formatos de salida, incluyendo:

- fichas tamaño A4;
- fichas compactas;
- formatos de cartelería;
- generación individual;
- impresión en lote.

Las plantillas incluyen márgenes y áreas de seguridad para mejorar el resultado en impresión física.

---

## 🖨️ Impresión por lotes

El sistema permite agregar múltiples productos a una cola de impresión.

La cola utiliza almacenamiento local para mantener temporalmente los productos seleccionados y generar posteriormente un único archivo PDF con múltiples fichas.

Esto reduce tareas repetitivas y agiliza procesos de impresión masiva.

---

## 📊 Calidad de datos

La aplicación incorpora reglas para evaluar el nivel de completitud de cada ficha.

Se consideran elementos como:

- códigos de producto;
- códigos EAN;
- marca;
- imagen;
- descripción;
- especificaciones técnicas.

El objetivo es identificar información incompleta antes de generar el material final.

---

## 👥 Control de acceso

El sistema utiliza control de acceso basado en roles.

De forma general, los perfiles permiten separar funciones de:

- administración;
- edición y validación;
- consulta e impresión.

Esto permite limitar operaciones sensibles según el nivel de acceso del usuario.

---

## 📥 Importación de datos

La solución permite incorporar catálogos mediante archivos Excel.

El backend procesa los archivos y normaliza la información antes de incorporarla al sistema.

Este mecanismo permite actualizar grandes volúmenes de productos sin necesidad de carga manual individual.

---

## 📁 Estructura del repositorio

```text
├── backend/
│   ├── lib/
│   │   ├── pdf/
│   │   ├── dataQuality.js
│   │   ├── geminiExtractor.js
│   │   └── supabase.js
│   ├── middlewares/
│   ├── routes/
│   ├── templates/
│   └── index.js
│
├── mobile/
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── admin/
│       │   └── editor/
│       ├── lib/
│       ├── App.jsx
│       └── main.jsx
│
├── etl/
├── supabase/
├── cloudbuild.yaml
└── README.md
```

---

## 🧩 Modularización

El proyecto fue organizado separando responsabilidades en distintos módulos.

El motor de generación de PDFs, por ejemplo, divide funcionalidades como:

- administración del navegador headless;
- carga de plantillas;
- procesamiento de logos;
- formateo de especificaciones;
- generación final del documento.

Del mismo modo, la interfaz administrativa y el editor de fichas se encuentran divididos en componentes independientes.

---

## 🔐 Seguridad

El proyecto contempla distintas medidas de seguridad:

- validación de autenticación;
- control de roles;
- protección de endpoints;
- configuración CORS;
- limitación de solicitudes;
- separación entre frontend y backend;
- variables de entorno para credenciales;
- políticas de acceso a base de datos y almacenamiento.

Los datos sensibles y credenciales no se incluyen en el repositorio.

---

## 📌 Estado del proyecto

Proyecto funcional en evolución.

El sistema fue desarrollado a partir de una necesidad operativa concreta: reducir tareas manuales relacionadas con la preparación, validación y generación de información técnica de productos.

Actualmente funciona como una solución integral que combina desarrollo web, automatización, gestión de datos, generación documental y herramientas de IA.

---

## 👨‍💻 Autor

**Jonatan Churruarin**

LinkedIn:  
https://www.linkedin.com/in/jonatan-churruarin/

GitHub:  
https://github.com/jochurru
