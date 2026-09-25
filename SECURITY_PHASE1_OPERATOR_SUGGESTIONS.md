# Fase 1 - Sugerencias tecnicas de operadores

## Regla implementada

El operador puede consultar, imprimir y proponer especificaciones tecnicas. No
puede modificar la ficha oficial, fotos, logos, EAN, marca, tipo de producto,
plantilla ni estado.

La propuesta se almacena separada de `especificaciones_json`. La impresion y la
consulta normal continúan usando exclusivamente los datos oficiales.

## Migracion requerida

Antes de habilitar la prueba manual de sugerencias debe aplicarse, en un entorno
de staging o prueba, la migracion:

`supabase/migrations/20260925000000_operator_technical_suggestions.sql`

La migracion es aditiva: agrega cuatro columnas y un indice parcial. No borra ni
reescribe fichas existentes.

## Pruebas de aceptacion

- Operador recibe `403` al intentar `/api/upload/imagen`.
- Operador recibe `403` al intentar `/api/fichas/aprobar`.
- `/api/fichas/sugerir` ignora foto, EAN, plantilla y estado manipulados.
- La ficha y el PDF oficial no cambian al enviar una sugerencia.
- La bandeja muestra la propuesta al coordinador del bloque correspondiente.
- Aprobar promueve las especificaciones y genera historial.
- Rechazar conserva foto, logo, EAN, plantilla y especificaciones oficiales.

## Rollback

El codigo puede volver al tag `security-hardening-baseline-2026-09-23`. Las
columnas nuevas pueden permanecer sin uso; no es necesario eliminarlas para
revertir la aplicacion.
