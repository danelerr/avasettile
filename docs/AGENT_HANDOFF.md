# AvaSettle — Prompt de continuidad para otro agente

> Documento de handoff. Si eres un agente que retoma AvaSettle desde cero, lee
> esto completo antes de tocar nada. Resume el estado real del proyecto, las
> decisiones tomadas, las convenciones, y qué falta. Última actualización:
> 11 junio 2026.

---

## 0. Cómo trabajar en este proyecto (reglas del dueño)

- **Dueño:** Daniel Cueto · `danielcuetorrico@gmail.com`. La autoría siempre es suya.
- **NO ejecutes comandos de git** (add/commit/push/rm) salvo que Daniel lo pida
  explícitamente. Edita archivos con herramientas de archivos, no con `git`.
  Si alguna vez pide un commit, el autor debe ser Daniel — nunca Claude como
  autor ni co-autor.
- **Verifica siempre antes de cerrar una tarea:** `pnpm exec eslint "{src,test}/**/*.ts"`,
  `./node_modules/.bin/tsc --noEmit -p tsconfig.json`, `pnpm test`, `pnpm test:e2e`,
  `pnpm build`. Todo debe quedar verde.
- **Filosofía del dueño:** dejó claro que NO quiere pensar en "MVP" ni "datos
  mockeados" — quiere cosas completas y production-grade. Cuando pidió mejoras,
  las quería todas, bien hechas, no a medias.
- **Entorno de la máquina de Daniel:** macOS, **sin Docker ni Postgres
  instalados** localmente. Probará el stack en otra computadora. No asumas que
  hay una base de datos local corriendo.
- Hay memoria persistente del proyecto en
  `~/.claude/projects/-Users-daniel-Desktop-test-avasettle/memory/` (índice en
  `MEMORY.md`, detalle en `project_avasettle.md`). Mantenla actualizada.

---

## 1. Qué es AvaSettle

Infraestructura **B2B multi-tenant** para que fintechs, PSPs y remesadoras de
LATAM **reciban, concilien y liquiden pagos en USDC sobre Avalanche**. No es una
wallet ni un checkout retail — es una **API de settlement institucional**.

**Frase núcleo:** "Una wallet recibe dinero. AvaSettle lo convierte en una
operación financiera (conciliable, auditable y liquidable)."

**Dos flujos centrales:**
- **Pay-in:** el cliente de la institución paga USDC. AvaSettle genera una
  dirección EVM única derivada (o una invoice on-chain vía PaymentRouter),
  detecta el pago on-chain, valida monto/confirmaciones, lo concilia y avisa.
- **Payout:** la institución envía USDC desde su treasury a wallets externas
  (liquidaciones, refunds, remesas salientes).

**Origen:** ganó **Top 5 en el Hackathon Institucional LATAM de Avalanche** +
premio monetario, como equipo individual. Daniel continúa el desarrollo para
aplicar a grants (ver §9, Retro9000).

**Contexto completo del producto/negocio:** está en `context.md` (raíz del
repo) — léelo para el "por qué" y la narrativa. Stack y módulos abajo.

---

## 2. Stack y arquitectura

- **Backend:** NestJS 11 + TypeScript. Gestor: **pnpm** (no npm).
- **Blockchain:** `viem` contra Avalanche **Fuji (testnet)** por defecto, o
  mainnet. Nunca se cambió de Avalanche; es Avalanche-native a propósito.
- **Persistencia:** **PostgreSQL directo vía `pg`**, sin ORM, sin estado en
  memoria. Postgres es **obligatorio** — la app lanza error al arrancar sin
  `DATABASE_URL`.
- **Smart contract:** `contracts/src/PaymentRouter.sol` (Solidity 0.8.28,
  OpenZeppelin, Foundry). Listo, **no deployado todavía**.
- **Auth:** dos tipos de API key (ver §4).
- **Puerto:** 3001 local (Docker expone 8080 internamente → 3001 afuera).
- **Docs:** Swagger/OpenAPI en `/docs`, JSON en `/docs/json`.

### Módulos en `src/`
`clients` (multi-tenancy), `payins`, `payouts`, `treasury`, `reconciliation`
(+ `auto-reconcile`), `reports`, `chain-flow` (adapter de compatibilidad con un
sistema externo "Chain Flow", endpoints `/api/*` en español), `webhooks`
(+ `webhook-dispatcher`), `audit`, `blockchain` (+ `treasury-signer`),
`database`, `configuration`, `observability`, `auth`, `common`, `health`,
`startup`.

**Eliminados a propósito** (eran mocks de hackathon, NO los recrees): `risk`
(scoring mock), `privacy` (eERC placeholder), `settlement` (fiat simulado),
`storage` (estado en memoria + driver JSON). Si Daniel pide "settlement fiat" o
"risk/AML", es integración real con un proveedor, no el mock viejo.

---

## 3. Persistencia y esquema

- **Una sola migración:** `db/migrations/001_init.sql` (se consolidaron todas;
  el proyecto no tiene usuarios/DBs desplegadas, así que se permitió romper
  compatibilidad). El runner es `src/database/migration-runner.ts` (checksum +
  tabla `avasettle_schema_migrations`).
- **Tablas `avasettle_*`:** `clients`, `payins`, `payouts`, `audit_events`,
  `counters` (contador de derivación), `idempotency_keys`,
  `webhook_outbox`, `webhook_deliveries`.
- **Scoping multi-tenant:** `client_id` en payins/payouts/audit_events/
  webhook_*; índice único `(client_id, external_id)` → creación idempotente y
  race-safe con `INSERT ... ON CONFLICT DO NOTHING`.
- **Ledgers** (`payin-ledger.service.ts`, `payout-ledger.service.ts`): el
  método `update(id, patch, guard?)` construye un UPDATE dinámico (whitelist
  camelCase→columna en `src/database/sql-patch.ts`) con `WHERE ... AND status =
  ANY($n)` opcional. **Esto es la clave anti-doble-pago:** las transiciones de
  estado las arbitra la base de datos, no el código.
- **Migraciones de prueba:** corren en CI con Postgres real (ver §6).

---

## 4. Autenticación (multi-tenancy)

| Audiencia | Header | Origen |
|---|---|---|
| **Operador de plataforma (admin)** | `x-avasettle-api-key: <admin key>` | env `AVASETTLE_ADMIN_API_KEY` |
| **Cliente (institución)** | `x-avasettle-api-key: <client key>` o `Authorization: Bearer` | emitida por `POST /v1/admin/clients` |

- Las client keys tienen formato `avk_<48hex>`. **Solo se guarda el hash
  SHA-256**; el plaintext se devuelve una sola vez (al crear o al rotar).
- `AdminApiKeyGuard` protege: `/v1/admin/clients*`, `/v1/reconciliation/run`,
  `/v1/reports/sweep-queue`.
- `ClientApiKeyGuard` protege todo lo demás bajo `/v1/*` y `/api/*`; resuelve
  la key → cliente y la adjunta al request (`request.avasettleClient`). Cada
  request solo ve los datos de su cliente.
- Resolución de keys cacheada 30s en memoria (`ClientsService`), invalidada al
  rotar/deshabilitar.
- Endpoints admin de clientes: crear, listar, get, `PATCH` (update/disable),
  `POST :id/rotate-key`.

---

## 5. Robustez ya implementada (no la rompas)

Estas son las garantías que costaron trabajo; respétalas:

1. **Transiciones atómicas anti-doble-pago.** `authorizePayout` reclama
   `prepared→authorized` con guard de estado antes de transmitir el ERC-20. Dos
   autorizaciones concurrentes → solo una transmite; la otra responde
   idempotente. Igual en accept/sweep de payins.
2. **Outbox durable de webhooks.** Los servicios hacen `await
   webhook.enqueue()` (persiste en `webhook_outbox` en el request path, nunca
   propaga error). `WebhookDispatcherService` drena en background con `FOR
   UPDATE SKIP LOCKED` (multi-instancia seguro), backoff 1s/5s/30s, recuperación
   de filas colgadas, firma HMAC-SHA256, y log terminal en `webhook_deliveries`.
3. **Reconciliación incremental.** `last_scanned_block` por payin; se escanea
   solo el delta (con overlap de 30 bloques anti-reorg) y se deduplica por
   `hash:logIndex`. Evita re-escanear miles de bloques en cada corrida.
4. **Retry de sweeps.** El auto-reconcile reintenta sweeps pending/failed
   (batch 5, cooldown 10 min) cuando `autoSweep=true`.
5. **Contador de derivación atómico** (`claimNextPayInIndex`, `UPDATE ...
   RETURNING`) → multi-instancia nunca deriva la misma dirección.
6. **Rate limit por API key** (hash) con fallback a IP; `AVASETTLE_TRUST_PROXY`
   configurable para resolver IP real detrás de un load balancer.
7. **Idempotencia** real por `(client, idempotency-key)`.

---

## 6. Tests y CI

- **Unit:** `pnpm test` (16 tests, ts-jest). Specs en `src/**/*.spec.ts`.
- **E2E:** `pnpm test:e2e` (arranca el AppModule con un DATABASE_URL dummy y
  auto-migrate off; solo prueba `GET /`).
- **Integración:** `pnpm test:integration` (`test/repositories.integration-spec.ts`).
  **Se salta sin `DATABASE_URL`**; cuando hay una, hace TRUNCATE y prueba
  contra Postgres real (rotación/disable de keys, aislamiento multi-tenant,
  carrera de autorización con `Promise.all`, outbox end-to-end, unicidad del
  counter). **Nunca apuntes esto a una DB con datos que importen.**
- **CI:** `.github/workflows/ci.yml`. Job 1: typecheck + lint + unit + e2e +
  build. Job 2 (`migrations`): levanta Postgres 16, aplica migraciones dos
  veces (idempotencia) y corre los tests de integración.
- **Tooling note:** headless Chrome tiene ancho mínimo de ventana ~500px;
  `--window-size=390` da render recortado de 500px (falsos overflows). Para
  emulación móvil real usa CDP `Emulation.setDeviceMetricsOverride` (hay un
  driver de ejemplo que se usó en `/tmp/cdp-shot.mjs` durante la sesión).

---

## 7. Cómo correr el proyecto

```bash
# Opción A — Docker Compose (recomendada; levanta Postgres + API)
docker compose up --build            # → http://localhost:3001
API_BASE_URL=http://localhost:3001 AVASETTLE_ADMIN_API_KEY=dev-admin-key-change-me \
  bash scripts/smoke.sh              # valida liveness, registro de cliente, auth, scoping

# Opción B — Node local + Postgres en Docker
docker compose up -d postgres
pnpm install
cp .env.example .env                 # DATABASE_URL=postgres://avasettle:avasettle@localhost:5432/avasettle
pnpm start:dev
```

- **Secretos** (`.env`, nunca commitear): `AVASETTLE_ADMIN_API_KEY`,
  `DATABASE_URL`, `AVASETTLE_TREASURY_PRIVATE_KEY`, `AVASETTLE_PAYIN_MNEMONIC`.
- **Config no-secreta:** `config/avasettle.json` (ejemplo en
  `config/avasettle.example.json`). Las env vars siempre ganan sobre el JSON.
  El loader es `src/configuration/config-file.loader.ts`.
- **Webhooks** se configuran **por cliente** (URL + secret) vía la admin API, no
  por env var.

---

## 8. Runbook de despliegue (testnet-first — el dueño es estricto con esto)

Daniel insistió: **local → Fuji → mainnet, nunca directo a mainnet.** El README
tiene el runbook completo y un checklist de mainnet. Resumen:

1. **Local:** Docker Compose + `scripts/smoke.sh` + flujos demo.
2. **Fuji:** funder treasury con AVAX de faucet + USDC test; deploy del
   PaymentRouter (`forge script contracts/script/Deploy.s.sol --rpc-url
   https://api.avax-test.network/ext/bc/C/rpc --broadcast`); deploy de la API
   con `AVASETTLE_NETWORK=avalanche-fuji`; pay-in real de punta a punta.
3. **Mainnet:** checklist en README (USDC mainnet
   `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` — verificar en Circle, secretos
   frescos nunca reusados, límites de payout, SSL, trust proxy, alertas).

Deuda conocida para mainnet de alto valor: **custodia hot-wallet** (la interfaz
`TreasurySignerService` ya está aislada para meter KMS/HSM/MPC — ~2 días de
adapter) y **rate limiting in-memory** (mover a Redis para multi-instancia).

---

## 9. Retro9000 (grant de Avalanche — contexto crítico)

Daniel va a aplicar a **Retro9000 ronda 4 (C-Chain)**, deadline **18 junio
2026**. Lo importante para no perder el tiempo:

- **Premia USO REAL on-chain, no código ni ideas.** Score = AVAX quemado en
  fees atribuible a tu proyecto, ponderado por calidad de usuarios (Verified
  con X linkeada > Connected > Unregistered). Multiplicador **5x para proyectos
  nuevos**. Top 20 del leaderboard se consideran; pool hasta 10k AVAX. Decisión
  final discrecional de la Foundation.
- **Implicación dura:** las direcciones derivadas son transferencias USDC
  normales, **no atribuibles** al proyecto. Solo el **PaymentRouter en mainnet**
  genera transacciones atribuibles (gas a tu contrato). → Deployar el router es
  prioridad #1 para el grant.
- **Lo de mayor retorno que se puede construir:** una **página demo de
  checkout** ("paga esta invoice de X USDC" → conectar wallet → `payInvoice()`
  → ver conciliación en vivo). Genera transacciones atribuibles + usuarios
  verificables, y sirve doble como demo de ventas. Daniel aún no la encargó pero
  está sobre la mesa.

---

## 10. Branding y landing

- **Guía de marca:** `docs/branding.md`. Logo = **pino nevado rojo/blanco** (en
  `AVASETTLE-logo.png`, raíz) — universo alpino de Avalanche + las capas =
  capas de settlement. Paleta: **Settle Red `#E0312E`**, Snow, Glacier, Slate.
- **Tipografía (aprobada por Daniel):** híbrido **Hanken Grotesk** (display) +
  **Inter** (UI/texto) + **JetBrains Mono** (datos: montos, hashes, direcciones).
  Hanken Grotesk = la versión de Google Fonts de "HK Grotesk".
- **Logo procesado:** se le quitó el fondo blanco con flood-fill (preservando
  capas blancas internas) → `avasettle-landing/src/assets/avasettle-mark.png`.
- **Landing:** proyecto **Astro 6** en `avasettle-landing/` (estático, español).
  Secciones: Nav (con hamburguesa móvil + CTA rojo dentro del menú), Hero (con
  animación CSS del ciclo de vida de un pay-in), Problema, Cómo funciona,
  Features, Para quién, Developers, Planes, CTA, Footer. Sistema de diseño en
  `src/styles/global.css`. Correr: `cd avasettle-landing && pnpm dev`.
- **Preferencias de diseño de Daniel (respétalas):** elegante pero no sobrio al
  punto de no tener diseño/animaciones; **CERO efectos glow** (nada de sombras
  difuminadas de color ni radiales); **evita jerga técnica y menciones de
  licencia en el copy** del landing (sin "MIT", "outbox", "HMAC", "multi-tenant"
  en texto visible — traducir a lenguaje de negocio). Animaciones sutiles
  (reveal-on-scroll) sí, gated en `html.js` para no esconder contenido sin JS.
- **Pendiente del landing:** los links a GitHub son placeholder
  (`https://github.com/`) hasta que Daniel dé la URL real del repo; falta
  `site` en `astro.config.mjs` (dominio); CTAs por `mailto:`.

---

## 11. Modelo de negocio

Desarrollado completo en `docs/business-model.md`. Esencia: híbrido
**plataforma (SaaS) + fee por pay-in confirmado + servicios**. Planes: Pilot
(gratis 60d), Growth (USD 499/mes + 0.4%), Scale (USD 1.990/mes + 0.25%),
Enterprise/on-prem (desde USD 60k/año). Venta = pipeline artesanal de **3 design
partners** (no marketing masivo); el grant es validación + caja puente.
Unit economics ~85% margen, meta año 1: 3–5 clientes = USD 40–120k ARR.

**Decisión de producto recomendada (ya discutida con Daniel):** priorizar
**landing + docs públicas primero**, **dashboard después** (cuando un piloto lo
pida; construirlo antes es diseñar a ciegas). El checkout hosted white-label es
la evolución natural de la página demo y lo que más acelera ventas.

---

## 12. Estado actual y próximos pasos sugeridos

**Todo verde:** lint, typecheck, 16 unit + e2e + 10 integración (en CI), build.
La landing compila y fue verificada visualmente (desktop + móvil + menú).

**Nada está commiteado por el agente** — Daniel maneja su propio git. Hay
cambios en working tree que él revisa y commitea.

### Cola de trabajo (orden de valor, ya consensuado)
1. **[deadline] Retro9000:** probar stack local → subir a GitHub (pedir URL a
   Daniel) → deploy Fuji (router + API) → deploy router mainnet → registrar en
   retro9000.avax.network → video demo 2-3 min. La **página demo de checkout**
   es lo de mayor retorno aquí.
2. **Producto:** checkout hosted white-label → SDK TS (desde el OpenAPI) →
   sandbox self-service → sitio de docs (Mintlify/Docusaurus) → dashboard mínimo
   (cuando un piloto lo pida) → custodia KMS + rate limit Redis.
3. **Negocio (sin código):** lista de 15-20 design partners + outreach;
   contenido técnico en español; explorar otros programas de Avalanche
   (Codebase, infraBUIDL).

### Documentos de referencia en el repo
- `context.md` — narrativa completa del producto/negocio (origen).
- `README.md` — quick start, runbook de deploy, modelo de auth, migraciones.
- `docs/api.md` — referencia de endpoints.
- `docs/branding.md` — guía de marca.
- `docs/business-model.md` — modelo de negocio.
- `LICENSE` — MIT (Daniel Cueto).

---

## 13. Convenciones de código (para que tus cambios pasen desapercibidos)

- TypeScript estricto; `pnpm exec eslint --fix` para formato (prettier
  integrado). Imports de tipos usados en decoradores deben ser `import type`
  (Nest + `emitDecoratorMetadata`).
- Nombres de campos de API en **inglés**, consistentes, sin abreviaturas
  crípticas. Estados del ciclo de vida con color semántico (pending/detected
  ámbar, confirmed verde, failed/expired rojo).
- Montos siempre con aritmética de enteros (atomic units / centavos), nunca
  floats. Direcciones/hashes en monoespaciada con truncado medio en UI.
- Comentarios en inglés en el código; documentación de negocio/marca en español.
- Nada de `git`. Verifica con la suite completa antes de cerrar.
