# Proyecto Fichas Técnicas - Easy Cencosud

Este repositorio contiene la estructura modular para el sistema Mobile-First de Fichas Técnicas del punto de venta de Easy Cencosud. El objetivo inicial es procesar y gestionar las fichas para el **Grupo de compras 45 (Herramientas)** de forma dinámica y extensible.

## Estructura del Proyecto

```
/Proyecto Fichas
  ├── backend/               # Servidor API Node.js (JavaScript - ES Modules)
  │     ├── lib/
  │     │     └── supabase.js  # Cliente de conexión a Supabase
  │     ├── routes/
  │     │     └── productos.js # Endpoints (GET /api/producto/:id, POST /api/fichas/aprobar)
  │     ├── .env.example       # Plantilla de variables de entorno para el backend
  │     ├── index.js           # Punto de entrada de Express
  │     └── package.json       # Dependencias y scripts de ejecución
  ├── etl/                   # Script de Ingesta y Carga de datos (Python)
  │     ├── load_sap_data.py   # Script de ETL para procesar el reporte SAP en XLSX
  │     └── requirements.txt   # Librerías de Python requeridas para el ETL
  └── supabase/              # Base de datos
        └── migrations/
              └── 20260819000000_init_schema.sql # Esquema DDL inicial
```

---

## 1. Configuración de Base de Datos (Supabase)

1. Creá un proyecto en [Supabase](https://supabase.com/).
2. Copiá el contenido del archivo [`supabase/migrations/20260819000000_init_schema.sql`](file:///c:/Users/Jonatan%20Churruarin/Desktop/Proyecto%20Fichas/supabase/migrations/20260819000000_init_schema.sql) y ejecutalo en el **SQL Editor** de la consola de Supabase. Esto creará las tablas:
   - `productos`
   - `codigos_ean`
   - `fichas_tecnicas`
   junto con sus índices y el trigger automático de actualización para `updated_at`.

---

## 2. Ingesta Inicial de Datos (ETL)

El script de ETL está en Python y procesará el archivo Excel `logistica local.XLSX` ubicado en tu carpeta de descargas: `C:\Users\Jonatan Churruarin\Downloads\logistica local.XLSX`.

### Preparación del ETL
1. Creá un archivo `.env` dentro de la carpeta `backend/` usando como guía el archivo `.env.example` y completá tus claves de Supabase:
   ```env
   SUPABASE_URL=https://tu-proyecto-id.supabase.co
   SUPABASE_KEY=tu-clave-service-role-o-anon
   ```
2. Instalá las dependencias requeridas en tu consola local:
   ```bash
   pip install -r etl/requirements.txt
   ```
3. Ejecutá el ETL:
   ```bash
   python etl/load_sap_data.py
   ```
   *El script leerá el Excel, aplicará un mapeo tolerante a problemas de codificación de caracteres, filtrará estrictamente el **Grupo de compras 45 (Herramientas)**, limpiará nulos, eliminará duplicados y los cargará en bloques en la tabla `productos`.*

---

## 3. Servidor de API Backend (Node.js)

El backend corre sobre Express en Node.js puro usando **ES Modules** para una sintaxis limpia.

### Arrancar el Servidor
1. Desde una terminal, ingresá a la carpeta `backend`:
   ```bash
   cd backend
   ```
2. Instalá las dependencias:
   ```bash
   npm install
   ```
3. Iniciá el servidor en modo desarrollo (se reinicia automáticamente con cambios):
   ```bash
   npm run dev
   ```

### Endpoints Disponibles
- **Health Check:** `GET http://localhost:3000/health`
- **Resolución de Producto/Ficha:** `GET http://localhost:3000/api/producto/:identificador`
  - Acepta tanto un SKU (ej. `148135`) como un EAN (si estuviera en `codigos_ean`).
  - Si el producto existe pero no tiene ficha, inicializa automáticamente un registro en `borrador_ia`.
- **Aprobación de Ficha:** `POST http://localhost:3000/api/fichas/aprobar`
  - Consolida y cambia el estado de la ficha técnica a `aprobado` con los campos validados del usuario.
