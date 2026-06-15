# AvaSettle — Guía de marca institucional

> Versión 1.0 — junio 2026. Aplica a producto, documentación, pitch decks,
> landing y comunicación con instituciones.

---

## 1. La marca en una frase

**AvaSettle convierte pagos en stablecoins sobre Avalanche en operaciones
financieras conciliables, auditables y liquidables.**

No somos una wallet ni un checkout cripto. Somos la capa de settlement que
las instituciones financieras de LATAM necesitan para operar dólares
digitales con los mismos controles que exigen a cualquier rail de pagos.

## 2. Nombre y uso

| Forma | Uso |
|---|---|
| **AvaSettle** | Única forma correcta. CamelCase, una palabra. |
| ~~Avasettle, AVASettle, Ava Settle~~ | Nunca. |
| AvaSettle On-chain Provider | Nombre técnico del servicio (API, OpenAPI title). |

Etimología explícita y deliberada: **Ava**(lanche) + **Settle**(ment). El
nombre dice exactamente qué hacemos y sobre qué red. En texto corrido la
primera mención lleva contexto: "AvaSettle, infraestructura de liquidación
en stablecoins sobre Avalanche".

## 3. El logo

El isotipo es un **pino nevado en capas rojas y blancas**. Lectura de marca:

- **El pino nevado** pertenece al universo visual alpino de Avalanche
  (montaña, nieve, cumbre) — señala de inmediato sobre qué ecosistema
  construimos, sin copiar el triángulo de Avalanche.
- **Las capas apiladas** son la metáfora central del producto: AvaSettle es
  una *capa* de settlement que se apila sobre la red. Cada nivel del árbol =
  una etapa del flujo (pay-in → conciliación → sweep → settlement → payout).
- **Rojo + blanco** = la paleta nativa de Avalanche, lo que refuerza la
  posición "Avalanche-native infrastructure".

### Reglas de uso

- Zona de seguridad: margen mínimo equivalente al 25% del alto del isotipo.
- Tamaño mínimo: 24 px de alto en pantalla.
- Sobre fondos oscuros usar la variante con trazos blancos; sobre fondos
  claros, la variante a color.
- **Para contextos institucionales** (propuestas, contratos, facturas,
  documentación técnica) preferir la variante **monocromática** (Slate 900 o
  blanco). El color pleno queda para marketing y producto.
- Nunca rotar, estirar, añadir sombras nuevas ni recolorear fuera de la paleta.

### Pendiente de producción (encargar a diseño)

- [ ] Lockup horizontal: isotipo + wordmark "AvaSettle".
- [ ] Variantes monocromáticas (Slate 900 / blanco) y versión 1 color rojo.
- [ ] Favicon / app icon (simplificar el pino a 3 capas para 16–32 px).
- [ ] SVG master (el PNG actual no escala para impresión).

## 4. Paleta de color

Derivada del logo y alineada con Avalanche:

| Token | Hex | Uso |
|---|---|---|
| **Settle Red** (primario) | `#E0312E` | Acciones primarias, acentos, isotipo |
| **Avalanche Red** (alterno) | `#E84142` | Solo en co-branding con Avalanche |
| **Snow** | `#F7FAFC` | Fondos claros, superficie de tarjetas |
| **Glacier** | `#DCE6EE` | Bordes, divisores, estados deshabilitados |
| **Slate 900** (tinta) | `#0F1A24` | Texto principal, variante monocroma del logo |
| **Slate 600** | `#46586A` | Texto secundario |
| **Confirm Green** | `#0E9F6E` | Estados `confirmed`, éxito |
| **Pending Amber** | `#D97706` | Estados `pending`/`detected`, advertencias |
| **Failed Red** | `#B91C1C` | Estados `failed`, errores (distinto del rojo de marca) |

Regla dura: **el rojo de marca nunca se usa para errores** — para eso está
Failed Red. En un producto financiero, confundir "marca" con "peligro"
destruye confianza.

Proporción recomendada en cualquier superficie: 70% neutros (Snow/Slate),
20% estructura (Glacier), 10% rojo.

## 5. Tipografía

Esquema híbrido: voz cálida en display, precisión en datos.

| Rol | Fuente | Fallback |
|---|---|---|
| Display: titulares, landing, marca, decks | **Hanken Grotesk** (600/700) | Inter, system-ui |
| UI y texto corrido (producto, docs) | **Inter** (400/500/600) | system-ui, Helvetica |
| Datos técnicos (hashes, montos, direcciones, código) | **JetBrains Mono** | ui-monospace, Menlo |

Reglas:

- Hanken Grotesk **solo en tamaños display** (≥24 px). En UI densa y tablas
  siempre Inter: mejor legibilidad en 12–14 px y soporte OpenType `tnum`
  (cifras tabulares) verificado.
- Los montos, tx hashes y direcciones EVM se muestran **siempre en
  monoespaciada** con truncado medio (`0x5425…1Bc65`) y, en columnas,
  alineados a la derecha. Es el detalle que hace que un producto financiero
  se sienta serio.
- Ambas familias están en Google Fonts (Hanken Grotesk es la versión
  publicada de HK Grotesk) — sin costo de licencia.

## 6. Voz y tono

**Somos el proveedor de infraestructura, no el protagonista.** El héroe de
cada historia es la institución cliente; AvaSettle es el sistema confiable
detrás.

- **Precisos.** "El pay-in se confirma tras 2 bloques" — nunca "súper rápido".
- **Operativos, no cripto-tribales.** Decimos *conciliación, liquidación,
  tesorería, auditoría*; evitamos *to the moon, degen, gas wars*. La palabra
  "cripto" se usa poco; preferimos **"stablecoins"** y **"dólares digitales"**.
- **Honestos con los límites.** Si algo es testnet, se dice testnet. Si la
  custodia es hot wallet, se documenta. La credibilidad institucional se
  gana declarando los límites antes de que pregunten.
- **Bilingües por diseño.** Producto y docs técnicas en inglés; ventas y
  materiales comerciales en español. LATAM compra en español, integra en inglés.

## 7. Mensajes núcleo (messaging pillars)

1. **"Una wallet recibe dinero. AvaSettle lo convierte en una operación
   financiera."** — el pitch de una línea.
2. **Conciliación automática on-chain.** Sabes quién pagó, cuánto, contra qué
   invoice y con cuántas confirmaciones — sin mirar un explorador.
3. **Multi-tenant desde el núcleo.** Cada institución con su API key, sus
   datos aislados, sus webhooks firmados.
4. **Avalanche-native.** Finalidad en segundos y fees de centavos: la única
   red donde el settlement institucional en stablecoins cierra
   económicamente para remesas y cobros recurrentes.
5. **Auditable por defecto.** Cada transición de estado deja un evento de
   auditoría; cada webhook, un registro de entrega.

### Tagline

- ES: **"Infraestructura de liquidación en stablecoins para LATAM."**
- EN: **"Stablecoin settlement infrastructure for LATAM institutions."**

### Boilerplate (para prensa / aplicaciones a grants)

> AvaSettle es una API B2B multi-tenant que permite a fintechs, PSPs y
> remesadoras de LATAM recibir, conciliar y liquidar pagos en USDC sobre
> Avalanche. Genera direcciones de depósito únicas por cobro, detecta y
> concilia los pagos on-chain, consolida fondos en tesorería y ejecuta
> payouts — con auditoría completa y webhooks firmados. AvaSettle fue Top 5
> en el Hackathon Institucional LATAM de Avalanche.

## 8. Aplicación en producto

- Estados del ciclo de vida con color semántico consistente en API, docs y
  futuro dashboard: `pending` ámbar · `detected` ámbar · `confirmed` verde ·
  `underpaid/overpaid` ámbar · `failed/expired` rojo Failed.
- Las respuestas de la API son parte de la marca: nombres de campo en inglés,
  consistentes, sin abreviaturas crípticas (ya cumplido en `/v1/*`).
- Swagger (`/docs`) hereda título y descripción de marca — es hoy nuestra
  "landing técnica" y debe mantenerse impecable.
