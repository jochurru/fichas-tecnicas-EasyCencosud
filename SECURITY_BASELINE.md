# Security Hardening Baseline

Fecha de linea base: 2026-09-23

Esta linea base precede las fases de endurecimiento de seguridad. Su objetivo es
detectar regresiones locales sin modificar permisos, politicas RLS, buckets ni
datos de produccion.

## Punto de retorno

- Tag local: `security-hardening-baseline-2026-09-23`
- Rama evaluada: `main`
- El tag apunta al estado anterior a los cambios de pruebas de Fase 0.

## Controles cubiertos

- El endpoint de salud no expone credenciales y conserva headers de Helmet.
- CORS habilita el frontend local y no habilita origenes desconocidos.
- La validacion de login rechaza dominios y contrasenas invalidas antes de Auth.
- Los endpoints sensibles rechazan solicitudes sin token.
- Los middlewares mantienen la jerarquia y las denegaciones basicas por rol.
- La resolucion actual de sectores queda documentada mediante pruebas.

## Ejecucion segura

```powershell
cd backend
node --test
```

Las pruebas HTTP levantan un proceso local efimero con `SKIP_STARTUP_INIT=true`
y credenciales simuladas. No crean usuarios, no modifican buckets y no realizan
operaciones autenticadas contra Supabase.

La prueba que escribe en Storage y `audit_logs` queda deshabilitada por defecto.
Solo se ejecuta deliberadamente contra un entorno de integracion con:

```powershell
$env:RUN_SUPABASE_INTEGRATION_TESTS='true'
node --test tests/pdfVerification.test.js
```

## Brechas P0 registradas

Los casos marcados como `TODO` representan controles pendientes: cuentas
desactivadas, limites de creacion de roles, resets dentro del bloque y
normalizacion de roles legacy. La restriccion de imagenes para operadores y el
aislamiento de aprobaciones por bloque se incorporaron en la Fase 1.

## Criterio para avanzar

- Suite unitaria y HTTP sin fallos.
- Build del frontend exitoso.
- Backend y frontend utilizables en localhost.
- Sin cambios remotos ni despliegue a produccion.
