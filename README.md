# Panel de ventas &amp; stock — GrupoOne

Dashboard web (Node.js + Express) que cruza 3 APIs de SAP publicadas en Integration
Suite — ventas, stock y rentabilidad (precio/costo) — sin base de datos propia:
todo se consulta on-line en cada carga, con una cache corta en memoria para no
saturar Integration Suite. Login con Google restringido a tu dominio corporativo.

## 1. Instalación

```bash
npm install
cp .env.example .env
```

Completá `.env` con los valores reales (ver secciones siguientes). **Nunca subas
`.env` a git** — ya está en `.gitignore`.

```bash
npm start        # producción
npm run dev      # con reinicio automático al guardar cambios
```

Por defecto corre en `http://localhost:3000`.

## 2. Crear el proyecto de Google OAuth (login)

No tenemos acceso a tu cuenta de Google, así que este paso lo tenés que hacer vos
(son 10 minutos):

1. Andá a [Google Cloud Console](https://console.cloud.google.com/) y creá un
   proyecto nuevo (o usá uno existente de tu organización).
2. **APIs y servicios → Pantalla de consentimiento OAuth**: tipo "Interno" si tu
   Google Workspace lo permite (así solo entra gente de tu dominio; si no,
   "Externo" y agregá tu dominio en `ALLOWED_EMAIL_DOMAIN` para filtrarlo igual
   desde la app).
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de
   OAuth**. Tipo de aplicación: "Aplicación web".
4. En "Orígenes de JavaScript autorizados" agregá la URL donde va a vivir la app
   (por ej. `https://dashboard.grupoone.com` o `http://localhost:3000` para
   probar local).
5. En "URI de redireccionamiento autorizados" agregá exactamente:
   `https://dashboard.grupoone.com/auth/google/callback` (o
   `http://localhost:3000/auth/google/callback` en local).
6. Copiá el **Client ID** y **Client secret** a `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   ALLOWED_EMAIL_DOMAIN=grupoone.com
   ```

Con eso el botón "Ingresar con Google" de `/login.html` ya funciona. Si alguien
inicia sesión con una cuenta fuera de `ALLOWED_EMAIL_DOMAIN`, la app lo rechaza
(`server/auth.js`, función `isEmailAllowed`).

## 3. Conectar las APIs reales

Las 3 llamadas están en `server/services/` (`ventasService.js`,
`stockService.js`, `rentabilidadService.js`). Todas usan Basic Auth leído desde
variables de entorno — **las credenciales nunca están en el código ni en el
frontend**, solo en `.env` (o en las variables de entorno del servidor donde lo
despliegues).

```
IS_BASIC_AUTH_USER=...
IS_BASIC_AUTH_PASS=...
VENTAS_API_URL=https://integration-suite-53jmw4yi.../http/DEV/z_vtastiendas
STOCK_API_URL=https://integration-suite-53jmw4yi.../http/PRD/grupo/z_stkreal_cons
RENTABILIDAD_API_URL=https://vhrosws1wd01.../zsb_prc_venta/ZC_PRC_VENTA
RENTABILIDAD_AUTH_USER=...
RENTABILIDAD_AUTH_PASS=...
```

Nos dijiste que la API de Rentabilidad se va a republicar en Integration Suite
con el mismo payload — el día que eso pase, **solo hay que cambiar
`RENTABILIDAD_API_URL`** (y sus credenciales, si son las mismas que las otras
dos, `RENTABILIDAD_AUTH_USER`/`PASS` pueden dejarse vacías y el código usa
`IS_BASIC_AUTH_USER`/`PASS` como fallback).

### Cosas que probamos con datos reales y cosas que quedaron como supuesto

Probamos las URLs contra `VENTAS_API_URL` y `STOCK_API_URL` desde este entorno:
ambas respondieron (403 sin credenciales válidas, lo cual confirma que son
accesibles sin VPN, tal como esperabas). La de Rentabilidad, al ser on-premise,
no respondió desde acá — habrá que probarla desde tu red.

Con los payloads/responses reales que nos pasaste, ya están resueltos:

- ✅ **Stock ahora es POST** (no GET) con el body `{ CompanyCode, StorageLocation,
  IniStk, to_MaterialItem }` — actualizado en `stockService.js`.
- ✅ **Campos reales de Rentabilidad** (`Material`, `Sociedad`, `Centro`,
  `Tienda`, `Descripcion`, `PrcVentaUN`, `CostoUN`, `MonedaVisualizacion`, etc.)
  cargados en el `FIELD_MAP` de `rentabilidadService.js`. También agregamos
  `cleanDescription()` porque la API devuelve literalmente `"Desconocido"`
  cuando no tiene descripción — en ese caso se usa la descripción del maestro
  local (`materials.json`) en su lugar.
- ✅ **SKU con formato distinto por API**: Ventas/Stock lo mandan con ceros a la
  izquierda (18 dígitos), Rentabilidad sin ceros (ej. `3492211208066`). Todas
  las llamadas ahora pasan por `server/services/skuUtils.js` (`normalizeSku`)
  para poder cruzarlas.

Queda **1 cosa importante por confirmar**, porque no la podemos deducir de los
ejemplos que nos pasaste:

- ⚠️ **Cómo se relaciona el "Store" de Ventas (ej. `T011`) con el
  "Centro"/"Storage Location" de Stock y Rentabilidad (ej. `KI01`/`KT11`)**.
  Rentabilidad no filtra por tienda en la URL — trae TODA la sociedad y
  filtramos nosotros por Centro+Tienda antes de cruzar con las ventas de esa
  sucursal (`dashboardService.js`). Stock si necesita el Storage Location para
  el POST. Hoy `server/data/stores.json` asume que cada `Store` de ventas
  corresponde 1 a 1 a un `plant`+`storageLocation` fijo — completá/corregí esos
  valores ahí apenas confirmes la relación real (o si es 1 a muchos, avisame y
  ajustamos la lógica de `dashboardService.js`).

Sigue pendiente (sin datos todavía):

- **Maestro de empresas/sucursales y maestro de materiales**: dijiste que
  existen esas APIs/tablas en SAP, pero todavía no tenemos el endpoint. Hoy
  viven como archivos estáticos fáciles de editar:
  `server/data/companies.json`, `server/data/stores.json`,
  `server/data/materials.json`. Cuando tengas el endpoint, reemplazamos las
  funciones de `server/services/masterDataService.js` por llamadas HTTP (con
  cache, como las otras) sin tocar el resto de la app.

### Modo demo (`DEMO_MODE_FALLBACK`)

Con `DEMO_MODE_FALLBACK=true`, si cualquiera de las 3 APIs falla (no
configurada, sin red, error 4xx/5xx, timeout) el dashboard sirve datos de
muestra en su lugar y no rompe la pantalla — así podés mostrar/probar la app de
punta a punta aunque todavía no estén las 3 APIs 100% conectadas. Poné
`DEMO_MODE_FALLBACK=false` cuando quieras que un error real se muestre como
error (recomendado antes de pasar a producción).

## 4. Cómo se calculan los KPIs

- **Unidades vendidas / Facturación / Margen bruto %**: `ART_QUANTITY` de la
  API de ventas × precio de venta y costo PPP de la API de rentabilidad,
  agregados por SKU (`server/services/dashboardService.js`).
- **Tendencia de ventas**: la API de ventas solo da el TOTAL de un rango de
  fechas, no un desglose diario. Para armar una tendencia sin pedirle a
  Integration Suite un llamado por día, dividimos el rango elegido en 6 tramos
  y hacemos 6 llamadas (ver `ventasService.getTendencia`). Es un compromiso:
  una tendencia más "escalonada" que diaria, pero sin multiplicar por 30 la
  carga sobre la API. Si en algún momento la API de ventas suma un parámetro
  de agrupación por día, esto se simplifica mucho.
- **Cobertura de stock (días)**: `stock actual ÷ (unidades vendidas en el
  período ÷ días del período)`. Si un SKU no tuvo ventas en el período, no se
  puede estimar cobertura con este método (se muestra "sin ventas").
- **Ticket promedio** (estaba en el mockup original) lo reemplazamos por
  **Margen bruto %**: la API de ventas no informa cantidad de tickets/compras,
  solo unidades por SKU, así que no se puede calcular un ticket promedio real
  con los datos disponibles hoy. El margen bruto sí es 100% calculable ahora
  que tenemos precio y costo, y es un KPI más accionable para el negocio.

## 5. Seguridad

- Las credenciales Basic Auth de las 3 APIs y el Client Secret de Google viven
  solo en variables de entorno del servidor — nunca llegan al navegador.
- La sesión de usuario es una cookie `httpOnly` firmada con `SESSION_SECRET`
  (generá un valor random largo, no dejes el de ejemplo).
- En producción, serví la app detrás de HTTPS y con `NODE_ENV=production` (la
  cookie de sesión se marca `secure` automáticamente en ese caso).
- No hay tabla de usuarios ni contraseñas propias que gestionar — el control de
  acceso es 100% "¿tu email pertenece al dominio permitido?".

## 6. Estructura del proyecto

```
server/
  index.js                 → arma Express, rutas, sesión, login con Google
  auth.js                  → configuración de Passport + Google OAuth
  cache.js                 → cache en memoria con TTL (no hay base de datos)
  middleware/requireAuth.js
  services/
    httpClient.js          → fetch con Basic Auth + timeout
    dateUtils.js
    ventasService.js       → llama la API de ventas
    stockService.js        → llama la API de stock (XML)
    rentabilidadService.js → llama la API de rentabilidad (OData)
    masterDataService.js   → nombres de empresa/sucursal/material (hoy locales)
    dashboardService.js    → cruza las 3 APIs y arma la respuesta para el frontend
  data/
    companies.json, stores.json, materials.json  → maestros locales (temporales)
    sampleData.js           → datos de muestra para el modo demo
public/
  login.html, dashboard.html, css/styles.css, js/app.js
```

## 7. Despliegue

Como es un Node/Express normal, corre en cualquier VM/contenedor Linux (Docker,
un servicio tipo Render/Railway, una VM propia, etc.). Solo necesita:

- Node.js 18+
- Las variables de entorno de `.env.example` completadas
- Un proceso que lo mantenga vivo (`pm2`, `systemd`, o el propio orquestador si
  usás contenedores) y, en producción, un proxy con HTTPS (nginx, Caddy, o el
  balanceador del proveedor) delante.

No necesita base de datos, ni Redis, ni ningún servicio adicional.
