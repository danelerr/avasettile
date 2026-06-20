# AvaSettle — Gobernanza de contratos (ownership → multisig/timelock)

> Cómo pasar el control de los contratos de AvaSettle de la EOA del deployer a
> un multisig y/o un timelock. Aplica a `PaymentRouter`, `SettlementVault` y
> `PrivateSettlementRegistry` (todos usan `Ownable2Step`).

## Por qué importa

Las funciones de owner controlan a dónde van los fondos:
`setTreasury`, `setTokenSupported`, `setOperator`, `setFunder`, `pause`,
`emergencyWithdraw`. Si esa llave es una sola EOA y se compromise, un atacante
puede redirigir la liquidación. Para producción el owner debe ser, como mínimo,
un **multisig** (Gnosis Safe) y, idealmente, un **TimelockController** detrás de
ese multisig para que cualquier cambio sensible tenga un retraso público.

`Ownable2Step` hace el traspaso a dos fases (initiate → accept), así una
dirección equivocada nunca puede dejar el contrato sin owner.

## Estado actual

- `PaymentRouter` está deployado y verificado en C-Chain mainnet
  (`0x91Bf4c06…149c2`). Su owner inicial es la EOA del deployer.
- **Pendiente:** transferir ese ownership a un multisig/timelock (requiere las
  llaves del deployer y del multisig — lo ejecuta Daniel, no el agente).

## Opción A — Owner = multisig (Gnosis Safe)

1. Crea un Safe en Avalanche C-Chain (https://app.safe.global) con los firmantes
   y el umbral que quieras.
2. Inicia el traspaso desde la EOA actual:
   ```bash
   CONTRACT=0x91Bf4c06…149c2 NEW_OWNER=<safe addr> \
   forge script contracts/script/TransferOwnership.s.sol \
     --rpc-url avalanche --account <keystore> --sender <owner EOA> --broadcast
   ```
3. Desde la **UI del Safe**, llama `acceptOwnership()` en el contrato (New
   transaction → Contract interaction → pega la ABI/selector). Al confirmarse,
   el Safe es el owner.

## Opción B — Owner = TimelockController (gobernanza con delay)

Recomendado para alto valor: el multisig *propone* cambios y se ejecutan tras un
delay público (p. ej. 48 h), dando tiempo a reaccionar.

1. Despliega el timelock (proposer = tu Safe):
   ```bash
   PROPOSER=<safe addr> MIN_DELAY=172800 \
   forge script contracts/script/DeployTimelockController.s.sol \
     --rpc-url avalanche --account <keystore> --sender <deployer> --broadcast --verify
   ```
   `EXECUTOR` por defecto es `address(0)` (cualquiera puede ejecutar tras el
   delay — seguro, porque el control es el delay). `TIMELOCK_ADMIN` debe ser 0
   en producción (timelock autoadministrado).
2. Transfiere el ownership del contrato al timelock:
   ```bash
   CONTRACT=0x91Bf4c06…149c2 NEW_OWNER=<timelock addr> \
   forge script contracts/script/TransferOwnership.s.sol \
     --rpc-url avalanche --account <keystore> --sender <owner EOA> --broadcast
   ```
3. Acepta desde el timelock: el Safe programa una operación (`schedule`) que
   llama `acceptOwnership()` en el contrato; tras `MIN_DELAY`, cualquiera la
   `execute`. A partir de ahí, todo cambio de owner pasa por
   schedule → wait → execute.

## Verificación post-traspaso

```bash
cast call 0x91Bf4c06…149c2 "owner()(address)" --rpc-url avalanche
cast call 0x91Bf4c06…149c2 "pendingOwner()(address)" --rpc-url avalanche  # debe ser 0x0
```

## Scripts

| Script | Para qué |
|---|---|
| `TransferOwnership.s.sol` | Inicia el traspaso (`CONTRACT`, `NEW_OWNER`) |
| `AcceptOwnership.s.sol` | Acepta el traspaso si el pending owner es una EOA con keystore |
| `DeployTimelockController.s.sol` | Despliega el timelock de gobernanza |
