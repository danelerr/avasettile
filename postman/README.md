# Colección Postman — AvaSettle API

Colección de prueba para la API de AvaSettle (settlement B2B en USDC sobre
Avalanche). Cubre los **37 endpoints** en 9 carpetas, con autenticación por
carpeta y **encadenamiento automático de variables** (la API key del cliente,
los IDs de pay-in/payout/invoice se guardan solos al crearlos).

## Archivos

- `AvaSettle.postman_collection.json` — la colección (formato v2.1).
- `AvaSettle.postman_environment.json` — environment **AvaSettle — Local**
  (`baseUrl`, `adminApiKey`, y las variables que se llenan solas).

## Importar

En Postman: **Import** → arrastra los dos archivos. Luego selecciona el
environment **AvaSettle — Local** (arriba a la derecha).

## Prerrequisito: el API corriendo

```bash
docker compose up -d            # → http://localhost:3001
```

Si lo levantas en otro host/puerto, edita `baseUrl` en el environment.
La `adminApiKey` por defecto es `dev-admin-key-change-me` (cámbiala para que
coincida con tu `AVASETTLE_ADMIN_API_KEY`).

## Flujo recomendado (en orden)

Las carpetas están ordenadas para correrse de arriba a abajo (ideal con el
**Collection Runner**):

1. **Health y metadata** — confirma que el servicio responde (público).
2. **Admin · Clientes** — `Crear cliente` guarda `{{clientApiKey}}` y
   `{{clientId}}` automáticamente (la key en texto plano se devuelve **una sola
   vez**).
3. **Pay-ins / Payouts / Treasury / Reportes** — usan esa `{{clientApiKey}}`;
   los `Crear…` guardan `{{payinId}}` / `{{payoutId}}`.
4. **Checkout (público)** — `Crear invoice` guarda `{{checkoutSessionId}}`.
5. **Chain Flow (compat ES)** — endpoints legacy `/api/*` en español.

## Autenticación

| Carpeta | Auth | Variable |
|---|---|---|
| Health, Checkout | ninguna (público) | — |
| Admin · Clientes, Reconciliación | admin | `{{adminApiKey}}` |
| Pay-ins, Payouts, Treasury, Reportes, Chain Flow | cliente | `{{clientApiKey}}` |

> `Reportes → Cola de sweeps` requiere la **admin** key; esa request sobreescribe
> el auth de su carpeta.

## Notas

- Los `externalId` usan `{{$timestamp}}` para ser únicos en cada corrida (evita
  respuestas idempotentes que devolverían el registro anterior).
- Endpoints que mueven fondos on-chain (`payouts/authorize`, `payins/sweep`,
  `topup`) requieren la tesorería fondeada con AVAX/USDC en la red configurada.
- El checkout requiere `AVASETTLE_PAYMENT_ROUTER_ADDRESS` configurado; si no, la
  creación de invoices responde 503.
- La colección se construyó desde el OpenAPI que el API expone en `/docs/json`
  (también importable directo en Postman, aunque sin el encadenamiento de
  variables).
