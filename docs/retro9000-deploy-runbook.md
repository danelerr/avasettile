# Runbook — Deploy del PaymentRouter + registro Retro9000

> Guía operativa paso a paso para **Daniel**. Objetivo: dejar el `PaymentRouter`
> desplegado y verificado en Avalanche C-Chain mainnet, conectado a la API, y el
> proyecto registrado en Retro9000 Ronda 4. Sigue el orden **Fuji → mainnet**.
>
> Todos los comandos de esta guía fueron validados contra el repo (el contrato
> compila con `forge create` usando el `foundry.toml` de la raíz). Última
> verificación: 2026-06-14 en Windows (Foundry 1.5.1, Solc 0.8.33).

---

## 0. Por qué esto es lo primero para el grant

Retro9000 puntúa por **AVAX quemado en fees atribuible a tu proyecto**. Solo las
**llamadas directas de primer nivel a tu contrato** cuentan. Implicación:

- Las direcciones derivadas (modo `derived-address`) son transferencias USDC
  normales → **NO atribuibles**.
- Cada `payInvoice()` al **PaymentRouter en mainnet** sí es una llamada directa a
  tu contrato → **gas atribuible** que suma al leaderboard.

Además: multiplicador **5x para proyecto nuevo** si el contrato se desplegó dentro
de los 2 meses del inicio de la ronda (Ronda 4 = junio 2026 → desplegar en junio
califica). El contrato debe estar **verificado en Snowtrace** o es inelegible.

➡️ **Desplegar y verificar el router en mainnet es el prerrequisito #1.** La página
de checkout es lo que luego genera las transacciones.

---

## 1. Prerrequisitos (una sola vez)

| Necesitas | Detalle |
|---|---|
| Foundry (`forge`, `cast`) | Ya instalado en tu máquina (1.5.1). `forge --version` para confirmar. |
| **Deployer key** | Llave privada EVM con **AVAX para gas**. En Fuji se fondea del [faucet](https://core.app/tools/testnet-faucet/). En mainnet, AVAX real. Será el **owner** del contrato. |
| **Treasury address** | Dirección EVM donde aterrizan los USDC cobrados. Puede ser la misma del owner o distinta. |
| **Snowtrace API key** | Gratis en [snowtrace.io](https://snowtrace.io) (Routescan). Para verificar el contrato. |
| RPC URLs | Fuji: `https://api.avax-test.network/ext/bc/C/rpc` · Mainnet: `https://api.avax.network/ext/bc/C/rpc` |

**Direcciones de referencia (ya en el repo):**

| Token | Red | Address | Decimales |
|---|---|---|---|
| USDC | Fuji (43113) | `0x5425890298aed601595a70AB815c96711a31Bc65` | 6 |
| USDC | Mainnet (43114) | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | 6 |

> ⚠️ Verifica el USDC de mainnet en [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses)
> antes de usarlo. `MIN_AMOUNT` recomendado = `1000000` (1.00 USDC) para evitar dust.

Exporta una vez por sesión (ejemplo Fuji — **nunca** pongas la llave en un archivo
versionado):

```bash
export RPC_URL="https://api.avax-test.network/ext/bc/C/rpc"
export DEPLOYER_PK="0x...tu_llave_con_AVAX..."
export OWNER="0x...tu_owner..."          # normalmente = dirección del deployer
export TREASURY="0x...tu_treasury..."
export USDC="0x5425890298aed601595a70AB815c96711a31Bc65"   # Fuji
export SNOWTRACE_API_KEY="...tu_api_key..."
```

---

## 2. Stage A — Fuji (prueba todo aquí primero)

### A.1 Desplegar el PaymentRouter

Desde la **raíz del repo** (`avasettile/`). El constructor es
`PaymentRouter(address initialOwner, address initialTreasury)`:

```bash
forge create contracts/src/PaymentRouter.sol:PaymentRouter \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_PK" \
  --constructor-args "$OWNER" "$TREASURY" \
  --broadcast
```

Anota la dirección que imprime (`Deployed to: 0x...`). Guárdala:

```bash
export ROUTER="0x...la_direccion_desplegada..."
```

### A.2 Habilitar USDC en el router

El router solo acepta tokens habilitados. La firma es
`setTokenSupported(address token, bool supported, uint256 minAmount)`:

```bash
cast send "$ROUTER" "setTokenSupported(address,bool,uint256)" \
  "$USDC" true 1000000 \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_PK"
```

Comprobar que quedó habilitado (debe devolver `true`):

```bash
cast call "$ROUTER" "supportedTokens(address)(bool)" "$USDC" --rpc-url "$RPC_URL"
```

### A.3 Verificar el contrato en Snowtrace

```bash
forge verify-contract "$ROUTER" \
  contracts/src/PaymentRouter.sol:PaymentRouter \
  --verifier-url "https://api-testnet.snowtrace.io/api" \
  --etherscan-api-key "$SNOWTRACE_API_KEY" \
  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$OWNER" "$TREASURY")" \
  --compiler-version 0.8.33
```

> Si `forge verify-contract` se queja de la versión de solc, usa la que reportó el
> deploy (`Solc 0.8.33` en la última verificación). Confirma el ✓ verde en
> `https://testnet.snowtrace.io/address/<ROUTER>`.

### A.4 Conectar el router a la API

Pon la dirección en tu `.env` (o `config/avasettle.json`) y reinicia la API:

```bash
AVASETTLE_PAYMENT_ROUTER_ADDRESS=0x...el_router...
```

Crea una invoice de router y verifica que la API la devuelve con `routerAddress` +
`routerInvoiceId`:

```bash
curl -s -X POST http://localhost:3001/v1/payins \
  -H "x-avasettle-api-key: <client-key>" -H "content-type: application/json" \
  -d '{"externalId":"ROUTER-TEST-001","asset":"USDC","amount":"1.00","collectionMode":"payment-router"}'
```

### A.5 Pago end-to-end de prueba

Usa la **página de checkout** (o un wallet manual) para pagar la invoice:
`approve(router, amount)` sobre USDC → `payInvoice(invoiceId, USDC, amount, metadata)`
sobre el router. Luego dispara la conciliación y confirma el estado:

```bash
curl -s -X POST http://localhost:3001/v1/payins/<id>/reconcile \
  -H "x-avasettle-api-key: <client-key>"
# status debe pasar a "confirmed" y sweepStatus "not_required"
```

✅ Si esto funciona en Fuji, el flujo está probado. Pasa a mainnet.

---

## 3. Stage B — Mainnet (genera el gas atribuible del grant)

Reexporta las variables para mainnet (**secretos frescos, nunca reuses los de Fuji**):

```bash
export RPC_URL="https://api.avax.network/ext/bc/C/rpc"
export DEPLOYER_PK="0x...llave_mainnet_fondeada_con_AVAX_real..."
export OWNER="0x...owner_mainnet..."
export TREASURY="0x...treasury_mainnet..."
export USDC="0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"   # verificar en Circle
```

Repite **A.1 → A.3** con estas variables, usando el verifier de mainnet:

```bash
# Verificación en mainnet
forge verify-contract "$ROUTER" contracts/src/PaymentRouter.sol:PaymentRouter \
  --verifier-url "https://api.snowtrace.io/api" \
  --etherscan-api-key "$SNOWTRACE_API_KEY" \
  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$OWNER" "$TREASURY")" \
  --compiler-version 0.8.33
```

### Checklist de la API en mainnet

- [ ] `AVASETTLE_NETWORK=avalanche-mainnet`
- [ ] `AVASETTLE_USDC_ADDRESS=0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E`
- [ ] `AVASETTLE_PAYMENT_ROUTER_ADDRESS=<router mainnet verificado>`
- [ ] Treasury key y mnemonic **frescos** (nunca reusar testnet)
- [ ] `AVASETTLE_MAX_PAYOUT_USDC` con un tope conservador
- [ ] `AVASETTLE_MIN_CONFIRMATIONS` ≥ 2 · `AVASETTLE_TRUST_PROXY` para tu LB
- [ ] `AVASETTLE_DATABASE_SSL=true` contra Postgres administrado
- [ ] Treasury fondeada solo con el capital de trabajo que toleres en hot wallet
- [ ] Alertas sobre `/health/readiness` y entregas de webhook fallidas

---

## 4. Stage C — Registro en Retro9000

Una vez el router está **desplegado y verificado en mainnet**:

1. Entra a [retro9000.avax.network](https://retro9000.avax.network) y conecta el
   wallet **owner/deployer** del contrato.
2. Da de alta el proyecto AvaSettle y agrega el **address del PaymentRouter** como
   contrato del proyecto.
3. **Prueba de propiedad:** firma con la llave del deployer (o aporta evidencia
   suficiente) cuando lo pida.
4. Completa **KYC/KYB** y acepta los **Términos y Condiciones** actualizados
   (obligatorio para reclamar premios).
5. Confirma que el proyecto queda **listado en la página Discover Projects**.
6. **Sube usuarios verificados:** invita a quienes paguen invoices a conectar su
   wallet en la plataforma y enlazar su X — los usuarios *Verified* pesan mucho más
   en el score que *Connected* o *Unregistered*.

> El snapshot mensual captura actividad de **todo** el periodo de la ronda, incluso
> antes de tu signup — pero regístrate cuanto antes para visibilidad y soporte de
> la comunidad.

---

## 5. Notas y deuda conocida

- **El README documenta el deploy con `forge script Deploy.s.sol --verify`**, pero
  ese camino **no compila tal cual** hoy: falta instalar `forge-std`
  (`contracts/lib/` no existe) y el `contracts/foundry.toml` remapea OpenZeppelin a
  `../node_modules` (fuera del directorio permitido por solc). Por eso este runbook
  usa `forge create` + `cast` + `forge verify-contract`, que funcionan con el
  `foundry.toml` de la raíz sin instalar dependencias nuevas. Si prefieres el script
  de Foundry (configura ambos tokens en una sola tx), primero hay que:
  `cd contracts && forge install foundry-rs/forge-std`, poner `libs = ["lib"]` y
  arreglar el remapping de OZ.
- El `scripts/demo/router-deploy-command.sh` imprime un `setTokenSupported(address,bool)`
  de **2 argumentos** que está desactualizado — la firma real es de **3**
  (`address,bool,uint256`). Usa los comandos de este runbook.
- Custodia: para mainnet de alto valor, mover la treasury de hot-wallet a KMS/HSM
  (la interfaz `TreasurySignerService` ya está aislada para ello).
