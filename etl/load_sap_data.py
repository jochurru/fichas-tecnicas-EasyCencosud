#!/usr/bin/env python3
import os
import sys
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno desde el archivo .env en la raíz del backend o el directorio local
load_dotenv()
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL y SUPABASE_KEY deben estar definidas en las variables de entorno o archivo .env")
    sys.exit(1)

# Inicializar cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

EXCEL_PATH = r"C:\Users\Jonatan Churruarin\Downloads\logistica local.XLSX"

def main():
    print(f"Leyendo archivo Excel desde: {EXCEL_PATH}...")
    try:
        # Leer la hoja "Sheet1"
        df = pd.read_excel(EXCEL_PATH, sheet_name="Sheet1")
    except Exception as e:
        print(f"Error al leer el archivo Excel: {e}")
        sys.exit(1)

    print(f"Total de filas leídas: {len(df)}")

    # Mapeo flexible de columnas para evitar problemas de codificación (caracteres especiales como á, ó, º)
    col_mapping = {}
    for col in df.columns:
        col_str = str(col).strip()
        col_lower = col_str.lower()
        
        if "material" == col_lower:
            col_mapping[col] = "sku"
        elif "texto breve" in col_lower:
            col_mapping[col] = "descripcion"
        elif "raz" in col_lower and "social" in col_lower:
            col_mapping[col] = "proveedor"
        elif "grupo de compras" in col_lower:
            col_mapping[col] = "grupo_compras"
        elif "grupo de art" in col_lower:
            col_mapping[col] = "grupo_articulos"

    # Verificar que las columnas críticas existan
    required_keys = {"sku", "descripcion", "grupo_compras"}
    found_keys = set(col_mapping.values())
    missing_keys = required_keys - found_keys
    if missing_keys:
        print(f"Error: No se encontraron las columnas requeridas: {missing_keys}")
        print("Columnas encontradas en el Excel:")
        print(df.columns.tolist())
        sys.exit(1)

    # Renombrar columnas
    df = df.rename(columns=col_mapping)
    
    # Mantener solo las columnas que nos interesan
    cols_to_keep = [v for v in col_mapping.values()]
    df = df[cols_to_keep]

    # Convertir 'grupo_compras' a string para filtrar de forma consistente
    df["grupo_compras"] = df["grupo_compras"].astype(str).str.strip()

    # Filtrar estrictamente por Grupo de compras == 45
    # Puede estar como '45', '45.0', '045'
    df_filtered = df[df["grupo_compras"].str.startswith("45") | (df["grupo_compras"] == "45")]
    print(f"Filas después de filtrar por Grupo de Compras == 45: {len(df_filtered)}")

    if df_filtered.empty:
        print("No se encontraron registros para el grupo de compras 45.")
        sys.exit(0)

    # Limpieza de datos
    # 1. sku a string y eliminar nulos
    df_filtered = df_filtered.dropna(subset=["sku"])
    df_filtered["sku"] = df_filtered["sku"].astype(str).str.strip()
    # Eliminar posibles decimales en el SKU si se leyó como float (ej. '148135.0' -> '148135')
    df_filtered["sku"] = df_filtered["sku"].apply(lambda x: x.split(".")[0] if x.endswith(".0") else x)
    df_filtered = df_filtered[df_filtered["sku"] != ""]

    # 2. descripcion
    df_filtered["descripcion"] = df_filtered["descripcion"].astype(str).str.strip()

    # 3. proveedor (rellenar nulos con 'DESCONOCIDO')
    if "proveedor" in df_filtered.columns:
        df_filtered["proveedor"] = df_filtered["proveedor"].fillna("DESCONOCIDO").astype(str).str.strip()
    else:
        df_filtered["proveedor"] = "DESCONOCIDO"

    # 4. grupo_articulos
    if "grupo_articulos" in df_filtered.columns:
        df_filtered["grupo_articulos"] = df_filtered["grupo_articulos"].fillna("").astype(str).str.strip()
        # Limpiar decimales si aplica
        df_filtered["grupo_articulos"] = df_filtered["grupo_articulos"].apply(lambda x: x.split(".")[0] if x.endswith(".0") else x)
    else:
        df_filtered["grupo_articulos"] = None

    # Eliminar duplicados por SKU
    df_filtered = df_filtered.drop_duplicates(subset=["sku"])
    print(f"Registros únicos a importar: {len(df_filtered)}")

    # Preparar registros para upsert
    records = []
    for _, row in df_filtered.iterrows():
        records.append({
            "sku": row["sku"],
            "descripcion": row["descripcion"],
            "proveedor": row["proveedor"],
            "grupo_compras": row["grupo_compras"],
            "grupo_articulos": row["grupo_articulos"] if row["grupo_articulos"] else None
        })

    # Carga masiva en lotes (batching) para evitar límites de payload o timeouts
    BATCH_SIZE = 100
    total_inserted = 0

    print("Iniciando la carga en Supabase...")
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i+BATCH_SIZE]
        try:
            # Ejecutar upsert
            supabase.table("productos").upsert(batch).execute()
            total_inserted += len(batch)
            print(f"Cargados: {total_inserted}/{len(records)}...")
        except Exception as e:
            print(f"Error al insertar el lote {i // BATCH_SIZE + 1}: {e}")
            # Continuamos con el siguiente lote o frenamos según se prefiera
            # En este caso, mostramos el error detallado
            print("Datos del lote con error:")
            print(batch[:2]) # Mostrar primeros 2 para depuración
            sys.exit(1)

    print(f"¡Carga completada exitosamente! Se procesaron {total_inserted} productos.")

if __name__ == "__main__":
    main()
