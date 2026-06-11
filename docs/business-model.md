# AvaSettle — Modelo de negocio

> Versión 1.0 — junio 2026. Documento interno de estrategia comercial.

---

## 1. Qué vendemos realmente

No vendemos "aceptar cripto". Vendemos **tiempo de ingeniería y riesgo
operativo eliminado**. Una institución que quiere operar USDC necesita
construir y mantener: indexación on-chain, derivación y custodia de
direcciones, conciliación, idempotencia, tesorería con sweeps, webhooks
confiables, auditoría y reportes. Eso son 6–12 meses de un equipo
blockchain senior (USD 150k–400k de payroll en LATAM) más el mantenimiento
perpetuo. AvaSettle lo entrega como API en una semana de integración.

**La frase de venta:** *"Publicar una wallet no es infraestructura
financiera. Te vendemos la diferencia."*

## 2. Cliente ideal (ICP) y dolor por segmento

| Segmento | Dolor concreto | Disparador de compra |
|---|---|---|
| **Remesadoras** (BO, PE, CO, MX⇄US) | Corresponsales caros/lentos; necesitan rail USD digital con conciliación contable | Costo por corredor > 3%; presión de competidores con cripto |
| **PSPs / agregadores** | Sus comercios piden aceptar USDC; construirlo internamente no justifica el ROI | Pérdida de comercios hacia PSPs cripto-friendly |
| **Fintechs con cuentas/billeteras** | Quieren saldo en dólares digitales sin armar equipo blockchain | Lanzamiento de feature "cuenta en dólares" |
| **Exportadores B2B / marketplaces** | Cobros internacionales con SWIFT caro; pagos a proveedores LATAM | Un cliente grande que quiere pagar en USDC |
| **Bancos exploratorios** | Mandato de innovación; necesitan piloto controlado y auditable | Regulación local que habilita activos digitales |

La cuenta que justifica el precio: una remesadora que mueve USD 500k/mes
pagando 2.5% de costo de rail (USD 12.5k/mes) puede bajar a <0.7% con
USDC+AvaSettle. Nuestro fee es una fracción del ahorro.

## 3. Por qué pagarían (y por qué a nosotros)

1. **Time-to-market:** semanas vs. 2–4 trimestres construyendo in-house.
2. **Riesgo operativo:** doble pago, fondos perdidos en direcciones,
   webhooks caídos — ya resuelto y testeado (transiciones atómicas, outbox
   durable, sweeps con retry).
3. **Auditabilidad:** los reguladores y los auditores externos piden
   trazabilidad; la damos por defecto.
4. **Foco LATAM:** adapter Chain Flow, español comercial, casos de remesas —
   los competidores globales (Fireblocks, BVNK, Bridge) no priorizan al
   mid-market latinoamericano ni a sus precios.
5. **Avalanche-native:** finalidad sub-segundo y fees de centavos hacen
   viables los micro-cobros y remesas que en otras redes no cierran.

## 4. Arquitectura de monetización

Modelo híbrido: **plataforma (SaaS) + uso (per-transaction) + servicios**.
La suscripción cubre el costo fijo de servir al cliente; el variable alinea
nuestro ingreso con su volumen; los servicios monetizan al segmento enterprise.

### Planes

| | **Pilot** | **Growth** | **Scale** | **Enterprise / On-prem** |
|---|---|---|---|---|
| Para quién | Evaluación técnica | Fintech/PSP en producción | Remesadora/PSP con volumen | Banco, regulado, o quien exige su propia infra |
| Precio plataforma | **USD 0 / 60 días** (Fuji o mainnet con límites) | **USD 499/mes** | **USD 1.990/mes** | **desde USD 60k/año** (licencia + soporte) |
| Fee por pay-in confirmado | — | 0.4% (mín. USD 0.05) | 0.25% | negociado (flat o por tramos) |
| Fee por payout ejecutado | — | USD 0.15 | USD 0.10 | negociado |
| Volumen incluido | USD 10k/mes | USD 250k/mes, luego por tramos | USD 2M/mes, luego por tramos | ilimitado |
| Clientes/tenants | 1 | 3 | 10 | ilimitado |
| Webhooks, reportes, auditoría | ✅ | ✅ | ✅ | ✅ |
| SLA | — | 99.5%, soporte siguiente día hábil | 99.9%, soporte 8×5 + canal directo | 99.95%, 24×7, gerente de cuenta |
| Setup / integración | self-service | self-service + 2 sesiones | onboarding guiado (USD 2.5k one-time) | proyecto de implementación (USD 15–40k) |

Notas de diseño de pricing:

- **El fee por pay-in confirmado es el corazón.** Solo cobramos cuando el
  cliente cobró — alineación total. El porcentaje baja con volumen para que
  nunca convenga irse a construir in-house ("racional hasta el final").
- **Pilot gratis pero con fecha de caducidad y límites** — el objetivo es
  llegar a producción, no regalar sandbox eterno.
- **On-premise como licencia anual, no venta perpetua:** el código se
  licencia con soporte y actualizaciones; sin renovación, sin parches. Es el
  único formato que un banco con requisitos de data-residency acepta, y el
  margen está en el soporte.

### Ingresos complementarios

- **Implementación enterprise** (USD 15–40k): integración con su core,
  mapeo contable, ambientes, capacitación.
- **Soporte premium / retainer técnico** (USD 1–3k/mes adicional).
- **Módulos futuros premium:** risk/AML real (integración con proveedor),
  off-ramp fiat vía partners (revenue share sobre el spread), settlement
  privado (eERC) para empresas que no quieren montos públicos.
- **Co-marketing con Avalanche:** grants (Retro9000) y programas de la
  Foundation como financiamiento no-dilutivo mientras llega el revenue.

## 5. Cómo se vende (motion B2B institucional)

Conseguir usuarios B2B institucionales **no es marketing masivo, es
pipeline artesanal**. El plan realista para un equipo de 1–2 personas:

### Fase 0 — Credibilidad (ahora → 3 meses)
- Caso demostrable público: API en Fuji/mainnet + demo + repo MIT + el sello
  "Top 5 Hackathon Institucional de Avalanche". El grant Retro9000, si sale,
  es validación de terceros.
- Contenido técnico en español: "cómo conciliar USDC on-chain", "anatomía de
  una remesa en stablecoins". En LATAM casi nadie escribe esto en español —
  es SEO regalado y autoridad.

### Fase 1 — Design partners (meses 1–6)
- **Meta: 3 design partners pagando Pilot→Growth.** No 30 leads: 3 que usen
  en producción.
- Fuentes: red del hackathon y del ecosistema Avalanche LATAM, cámaras
  fintech (Fintech Bolivia, Colombia Fintech, Fintech México), PSPs medianos
  que ya conocemos, y el propio Chain Flow como primer integrador.
- Oferta de design partner: 50% de descuento año 1 + roadmap influence, a
  cambio de caso de estudio con nombre y logo.
- Ciclo de venta esperado: 2–4 meses (fintech), 6–12 (banco). Vender primero
  a quien no necesita comité.

### Fase 2 — Repetibilidad (meses 6–18)
- Convertir los casos de estudio en el motor: webinars con el partner,
  referidos con incentivo (un mes de plataforma).
- Canal indirecto: consultoras/integradores fintech locales que implementan
  cores bancarios — les pagamos 10–15% del primer año por deal traído.
- Presencia en 2–3 eventos al año donde están los compradores (Avalanche
  Summit LATAM, Fintech Americas, eventos de cámaras locales).

### El proceso de venta típico

1. **Demo técnica (45 min):** crear cliente → cobrar USDC real en Fuji →
   ver conciliación y webhook en vivo. La demo ES el pitch.
2. **Sandbox con su equipo (1–2 semanas):** les damos un tenant en Fuji y
   acompañamos su integración (aquí se gana el deal: developer experience).
3. **Piloto en producción con límites** (montos bajos, 30–60 días, éxito
   medido en: % conciliación automática, tiempo de liquidación, incidencias).
4. **Contrato anual** (Growth/Scale) con MSA + DPA + SLA. Facturación
   mensual; enterprise por adelantado anual.

## 6. Objeciones esperables y respuesta

| Objeción | Respuesta |
|---|---|
| "¿Y la custodia de la treasury?" | Hot wallet con límites para piloto; roadmap KMS/HSM/MPC para producción de alto valor; opción on-prem donde la llave nunca sale de su perímetro. |
| "¿Cumplimiento/AML?" | AvaSettle es infraestructura de conciliación; el screening AML se integra con su proveedor o con el módulo risk (roadmap). Damos la trazabilidad que su oficial de cumplimiento necesita. |
| "¿Qué pasa si AvaSettle desaparece?" | Licencia on-prem con código fuente en escrow para enterprise; datos siempre exportables (Postgres estándar). |
| "¿Por qué no Fireblocks/BVNK?" | Precio enterprise global vs. nuestro mid-market LATAM; ellos venden custodia, nosotros vendemos conciliación + settlement operativo con soporte en español. |
| "¿Solo Avalanche?" | Hoy sí, por costo y finalidad. La arquitectura aísla la capa chain (viem) — multi-chain es roadmap comercial, no reescritura. |

## 7. Unit economics (hipótesis a validar)

- Costo de servir un tenant Growth: ~USD 40–80/mes (infra compartida Cloud
  Run + Postgres + RPC). Margen bruto del plan: >85%.
- Cliente Growth típico: USD 499 + (USD 150k vol × 0.4%) = **~USD 1.1k/mes** → USD 13k ARR.
- Cliente Scale típico: USD 1.990 + (USD 1M × 0.25%) = **~USD 4.5k/mes** → USD 54k ARR.
- **Meta año 1:** 3–5 clientes pagando = USD 40–120k ARR + grants. Suficiente
  para validar pricing antes de levantar capital o escalar equipo.

## 8. Riesgos del modelo

- **Ciclo de venta institucional largo** → mitigación: empezar por fintechs
  sin comité y el canal Chain Flow; grants como puente de caja.
- **Dependencia de un solo rail (Avalanche)** → mitigación: abstracción de
  chain ya aislada; narrativa "Avalanche-first, no Avalanche-only".
- **Regulación cripto heterogénea en LATAM** → mitigación: vender la capa
  técnica (el cliente es el regulado); priorizar países con marco claro.
- **Competidores con más capital** → mitigación: nicho mid-market LATAM +
  precio + soporte en español + on-prem que los SaaS globales no ofrecen.
