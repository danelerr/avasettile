AvaSettle es una infraestructura B2B para pagos y liquidación con stablecoins sobre Avalanche, pensada para empresas financieras de LATAM.

La idea central de AvaSettle es convertir pagos en stablecoins sobre Avalanche en operaciones institucionales conciliables, auditables y liquidables.

Dicho más simple: no se trata solo de recibir USDC en una wallet. Se trata de que una empresa, fintech, banco, PSP, remesadora o plataforma pueda recibir pagos en cripto de forma operable: saber quién pagó, cuánto pagó, a qué invoice corresponde, si la transacción fue confirmada, dónde están los fondos, cómo se consolidan, cómo se reportan y cómo se liquidan.

AvaSettle no es una wallet cripto. AvaSettle es una API institucional.

La tesis principal es esta:

Aceptar stablecoins es fácil. Institucionalizarlas es difícil.

Una empresa puede publicar una dirección de wallet y recibir USDC, pero eso no resuelve el problema financiero real. Una institución necesita conciliación, trazabilidad, treasury management, control de riesgo, reportes, settlement, auditoría e integración con sus sistemas internos. AvaSettle busca resolver justamente esa capa.

El origen de la idea nació de una necesidad institucional real: cómo permitir que una empresa financiera pueda operar stablecoins on-chain sin construir desde cero toda la infraestructura blockchain, operativa, contable y de conciliación. La primera intuición fue: “¿cómo puede una institución recibir depósitos en USDC desde wallets externas, detectarlos on-chain, conciliarlos y acreditarlos internamente?”. Esa idea luego evolucionó hacia algo más amplio: un proveedor B2B de pay-in, payout, conciliación y settlement sobre Avalanche.

Al principio, la idea estaba muy ligada al concepto de depósitos on-chain para una institución financiera: clientes enviando USDC desde wallets o exchanges externos hacia una cuenta o saldo institucional. Después, durante el hackathon de Avalanche LatAm Institucional, la idea se convirtió en AvaSettle: una infraestructura para que empresas de LATAM puedan recibir y enviar pagos con stablecoins sobre Avalanche.

El enfoque cambió de “un banco recibiendo USDC” a “cualquier empresa financiera o institución puede integrar una API para operar stablecoin payments”.

El flujo principal de AvaSettle es el pay-in.

El pay-in es cuando el cliente de una empresa paga en USDC. La empresa crea un cobro mediante la API de AvaSettle. AvaSettle genera una dirección EVM real derivada o una invoice programable. El cliente envía USDC sobre Avalanche. AvaSettle detecta la transacción on-chain, valida el monto, revisa confirmaciones, registra el hash, actualiza el estado del pago y le dice a la empresa: “sí, este cliente pagó”.

Ese es el corazón del producto.

El payout es la segunda parte del sistema. Sirve para que la institución o empresa pueda enviar fondos desde una treasury hacia wallets externas. Eso puede usarse para liquidar a comercios, pagar proveedores, hacer refunds, procesar remesas salientes o permitir retiros.

Entonces, AvaSettle tiene dos grandes flujos:

Pay-in: cliente paga a empresa.

Payout: empresa/institución paga a beneficiario externo.

El pay-in es la entrada de dinero. El payout es la salida o liquidación.

La arquitectura conceptual de AvaSettle es:

Empresa o institución crea un cobro.
AvaSettle genera una dirección o invoice.
Cliente paga USDC en Avalanche.
AvaSettle detecta el pago.
AvaSettle reconcilia monto, token, red y tx hash.
AvaSettle actualiza el estado.
AvaSettle puede consolidar fondos a treasury.
AvaSettle calcula settlement fiat simulado.
AvaSettle genera reportes.
AvaSettle permite payouts desde treasury.

El producto está pensado como una API B2B. Las empresas no necesitan que sus usuarios sepan qué es AvaSettle. AvaSettle vive detrás de la infraestructura de la empresa. La empresa integra la API y ofrece a sus clientes pagos con stablecoins.

El usuario final solo ve algo como: “paga 10 USDC a esta dirección” o “paga esta invoice”. La institución ve lo importante: estado, monto, tx hash, confirmaciones, riesgo, settlement y reportes.

El mercado potencial de AvaSettle está en LATAM, especialmente en países donde las stablecoins ya tienen demanda por inflación, pagos internacionales, remesas, comercio digital, restricciones bancarias o necesidad de dólares digitales.

Los clientes potenciales son:

Fintechs que quieran aceptar pagos en USDC.

PSPs que quieran agregar rails cripto a su infraestructura.

Remesadoras que quieran usar stablecoins para entrada o salida de dinero.

Bancos o entidades financieras que quieran explorar stablecoin payments.

Marketplaces que quieran recibir pagos internacionales.

Empresas exportadoras o importadoras que cobran o pagan en dólares digitales.

Plataformas B2B que necesitan liquidar proveedores.

Startups que quieren aceptar cripto sin construir infraestructura blockchain.

Empresas que quieren recibir pagos en stablecoins pero liquidar o reportar en fiat.

El problema de mercado no es solamente tecnológico. Es operativo e institucional. Muchas soluciones cripto muestran una wallet o un checkout, pero no resuelven conciliación, treasury, reportes, auditoría, riesgo e integración con sistemas internos.

AvaSettle busca ser esa capa institucional.

La propuesta de valor es:

AvaSettle permite que empresas financieras lancen productos de pagos con stablecoins más rápido, sin construir desde cero indexación on-chain, manejo de direcciones, conciliación, treasury, reportes, payouts y settlement.

En otras palabras:

Una wallet recibe dinero.
AvaSettle convierte ese dinero en una operación institucional.

El enfoque de negocio es B2B. AvaSettle no monetiza al usuario final. Monetiza a empresas e instituciones.

Los modelos de monetización posibles son:

SaaS mensual por uso de la plataforma.

Fee por transacción procesada.

Fee por pay-in confirmado.

Fee por payout ejecutado.

Spread o comisión sobre conversión stablecoin-fiat.

Setup fee por integración enterprise.

Módulos premium de reportes, riesgo, cumplimiento y privacidad.

Módulo premium de eERC/private settlement.

Soporte técnico y mantenimiento institucional.

AvaSettle podría venderse como “Stripe for stablecoin settlement”, pero con enfoque institucional y LATAM. No como un checkout retail simple, sino como una capa de settlement, conciliación y treasury para instituciones.

Técnicamente, durante el hackathon se construyó un backend en NestJS con TypeScript. Se usó viem para interactuar con Avalanche y contratos ERC-20. La red principal de prueba fue Avalanche Fuji. El activo principal fue USDC en Fuji. La API expone documentación Swagger/OpenAPI.

Los módulos principales que se trabajaron fueron:

Pay-ins.

Payouts.

Treasury.

Reconciliación.

Settlement.

Reportes.

Risk scoring.

Chain Flow adapter.

Privacy/eERC adapter o roadmap.

PaymentRouter smart contract path.

Storage.

Health/readiness.

Swagger/OpenAPI.

En el módulo de pay-ins, AvaSettle crea cobros y genera direcciones EVM reales derivadas desde una mnemonic configurada. Esto fue importante porque se decidió no usar direcciones mock. Cada pay-in puede tener una dirección real. Esa dirección queda asociada a una invoice o intent de pago.

El backend guarda el depositAddress, el derivationIndex y el startBlock. Luego, para reconciliar, escanea eventos ERC-20 Transfer hacia esa dirección. Si detecta que llegó el monto esperado, marca el pay-in como detectado, confirmado, underpaid u overpaid según corresponda.

Esto permite que una empresa sepa si su cliente pagó, sin revisar manualmente un explorador de bloques.

En el módulo de payouts, AvaSettle usa una treasury wallet institucional para enviar ERC-20 a una wallet destino. Esto permite simular o ejecutar pagos salientes, liquidaciones, refunds o retiros.

El payout funciona con una treasury private key configurada en variables de entorno. Para demo se usa una hot wallet limitada; para producción se planteó que debería integrarse con Fireblocks, KMS, HSM, MPC o un custodio institucional.

En el módulo de treasury, AvaSettle puede consultar balances de la treasury, tanto de AVAX para gas como de USDC u otros ERC-20 configurados.

En el módulo de reconciliación, AvaSettle puede revisar el estado de operaciones on-chain. Para payouts, puede verificar receipts y confirmaciones. Para pay-ins, puede escanear logs Transfer y actualizar estados. También se planteó una reconciliación automática o semiautomática.

En el módulo de settlement, AvaSettle calcula una liquidación fiat simulada. Por ejemplo: un cliente paga 100 USDC, AvaSettle calcula un fee, un monto neto, un tipo de cambio y un monto liquidable en moneda fiat. Esto es clave para venderlo a empresas financieras, porque convierte un pago cripto en algo que puede ser reportado como operación financiera.

En el módulo de risk scoring, se implementó un modelo mock, pensado como punto de entrada para una integración futura con herramientas como Wavy Node. La idea es que AvaSettle pueda marcar operaciones como normales, en revisión o rechazadas según monto, wallet, riesgo o proveedor externo.

En el módulo de reportes, AvaSettle expone resúmenes operativos: pay-ins, payouts, settlements, estados y volúmenes. Esta parte hace que el producto se vea como backoffice institucional, no solo como un script de blockchain.

Chain Flow apareció como un proyecto de un compañero que tenía lógica de pay-in/payout en Laravel. Al principio, AvaSettle se pensó como el módulo on-chain de Avalanche que iba a ejecutar payouts para Chain Flow. Por eso se construyeron endpoints compatibles con Chain Flow:

POST /api/prepararretiro

POST /api/autorizarretiro

GET /api/consultarestadoretiro

POST /api/consultarestadoretiro

Estos endpoints permiten que un sistema externo mande datos como monto, cuenta destino, transferencia bloque, retiro pago, procesador de pagos, etc., y AvaSettle responda con un estado, un providerPayoutId y un txHash si corresponde.

Sin embargo, durante la evolución de la idea quedó claro que AvaSettle no debía presentarse como un plugin de Chain Flow. Chain Flow pasó a ser solo un adapter enterprise, un ejemplo de integración con sistemas existentes. El producto principal es AvaSettle.

La narrativa final fue:

Chain Flow es un posible integrador.
AvaSettle es la infraestructura.

También se discutió la necesidad de un smart contract para que el proyecto se vea más Avalanche-native. Como el backend ya interactúa con Avalanche y USDC, técnicamente no era obligatorio un contrato propio para el flujo de pay-ins con direcciones derivadas ni para payouts ERC-20. Sin embargo, para el hackathon se planteó un PaymentRouter como camino de smart contract.

La idea del PaymentRouter es permitir invoices programables on-chain. En vez de que el cliente pague a una dirección derivada, podría llamar a un contrato con un invoiceId, token, amount y merchant. El contrato transfiere ERC-20 hacia treasury y emite un evento InvoicePaid. Luego AvaSettle escanea ese evento y reconcilia la invoice.

Esto permite dos modos de pay-in:

Deposit address mode: más simple e integrable con instituciones existentes.

PaymentRouter mode: más on-chain, programable y demostrable como smart contract.

También se habló de eERC20 o eERC como un camino futuro para privacidad institucional. La idea es que las empresas no quieren que todos sus pagos, ventas, balances y proveedores sean públicamente visibles. eERC permitiría un modo privado y auditable para pagos empresariales. No se planteó como core inmediato del MVP porque tiene complejidad adicional de registros, pruebas y contratos, pero sí como un roadmap fuerte para “private settlement mode”.

La narrativa de eERC sería:

USDC público puede convertirse en un activo privado tipo eUSDC.
Las empresas pueden hacer pagos privados.
Un auditor autorizado podría verificar información.
Se protege la privacidad comercial sin perder auditabilidad.

AvaSettle, entonces, puede tener varios modos de settlement:

Direct payout mode: treasury envía ERC-20.

Deposit address pay-in mode: direcciones derivadas reales.

PaymentRouter mode: invoices programables on-chain.

Future privacy mode: eERC private settlement.

Durante el desarrollo se usó storage JSON local para avanzar rápido en el hackathon. Esto permitió guardar payouts, pay-ins, settlements, audit events y contadores de derivación en un archivo local. Sin embargo, se identificó que esto no es suficiente para producción. El siguiente paso planteado fue migrar a PostgreSQL, posiblemente usando Firebase SQL Connect, sin ORM, con SQL puro y pg.

La base de datos propuesta para AvaSettle incluye tablas para:

institutions

merchants

assets

treasury_wallets

derivation_counters

payin_intents

payout_requests

blockchain_transactions

settlements

risk_assessments

audit_events

idempotency_keys

webhook_endpoints

payment_router_intents

eerc_private_payment_intents

El objetivo de la base de datos es no perder el mapping crítico entre pay-in, depositAddress, derivationIndex, txHash y settlement.

Uno de los elementos más importantes técnicamente es el derivationIndex. Como AvaSettle genera direcciones reales, debe persistir qué índice ya fue usado para no reutilizar direcciones. En producción, eso debe ser atómico en base de datos.

También se discutió el sweep. En el flujo de direcciones derivadas, si un cliente paga USDC a una dirección derivada, los fondos quedan en esa dirección. Para consolidarlos a treasury, hay que hacer sweep: la dirección derivada debe firmar una transacción ERC-20 transfer hacia treasury. Pero para eso necesita AVAX para gas. Entonces hay dos opciones: top-up de gas desde treasury o PaymentRouter para evitar fondos dispersos en muchas direcciones.

El sweep fue identificado como una pieza clave pendiente o en evolución:

Pay-in detecta fondos.
Reconciliation confirma pago.
Sweep consolida a treasury.
Settlement queda listo para liquidación.

La versión para hackathon se enfocó principalmente en la arquitectura, los módulos, la lógica de pay-ins, payouts, reconciliación, settlement, risk, reports y documentación. El despliegue final no se logró a tiempo. La demo fue principalmente explicativa, pero el repositorio y la idea quedaron suficientemente sólidos.

A pesar de no lograr un deploy perfecto, AvaSettle fue reconocido como Top 5 en la Hackathon LatAm Institucional de Avalanche. Ese fue uno de los mayores logros del proyecto. El proyecto recibió un premio de 300 USD. Además, el hecho de haber quedado Top 5 siendo un equipo individual es especialmente relevante.

Esto demuestra que la idea tenía fuerza, incluso si la demo técnica no fue perfecta.

Los logros principales de AvaSettle fueron:

Quedar Top 5 en la Hackathon LatAm Institucional de Avalanche.

Recibir un premio de 300 USD.

Ser desarrollado por una sola persona como equipo individual.

Construir una propuesta institucional alineada con Avalanche.

Definir una narrativa clara de pagos institucionales con stablecoins.

Crear un backend modular en NestJS.

Implementar pay-ins reales con direcciones EVM derivadas.

Implementar reconciliación on-chain de eventos ERC-20.

Implementar payouts desde treasury.

Implementar settlement fiat simulado.

Implementar reportes operativos.

Implementar risk scoring mock.

Implementar documentación Swagger/OpenAPI.

Diseñar compatibilidad con sistemas empresariales como Chain Flow.

Plantear PaymentRouter como smart contract de invoices programables.

Plantear eERC como roadmap de privacidad institucional.

Identificar la necesidad de PostgreSQL/Firebase SQL Connect.

Identificar la necesidad de sweep y treasury consolidation.

Construir una narrativa de negocio B2B.

El pitch final de AvaSettle puede resumirse así:

AvaSettle convierte pagos en stablecoins sobre Avalanche en operaciones institucionales conciliables, auditables y liquidables para empresas financieras de LATAM.

O de forma más desarrollada:

AvaSettle es una API B2B para que instituciones financieras, fintechs, PSPs, remesadoras y empresas puedan recibir, conciliar, consolidar, liquidar y enviar pagos en USDC sobre Avalanche. El sistema permite crear pay-ins, generar direcciones EVM reales, detectar pagos on-chain, asociarlos a invoices, calcular settlement, consolidar treasury y ejecutar payouts. No es una wallet, sino una capa de infraestructura institucional para operar stablecoin payments.

La ventaja de AvaSettle está en que conecta tres mundos:

Blockchain: Avalanche, USDC, ERC-20, tx hashes, logs, smart contracts.

Operación financiera: conciliación, settlement, treasury, payouts, reportes.

Instituciones: API B2B, adapters, risk scoring, auditabilidad, roadmap de compliance.

El proyecto es especialmente relevante para LATAM porque las stablecoins ya son usadas como refugio de valor, medio de pago, herramienta de remesas y alternativa para pagos internacionales. Sin embargo, las empresas no pueden operar solo con wallets sueltas. Necesitan infraestructura.

AvaSettle apunta a ser esa infraestructura.

Los casos de uso posibles son:

Una remesadora recibe USDC de un usuario y liquida a un beneficiario.

Un marketplace permite que clientes paguen en USDC y luego liquida a vendedores.

Una fintech ofrece cuentas o saldos en stablecoins con conciliación on-chain.

Un PSP ofrece a comercios la opción de aceptar USDC.

Una empresa exportadora cobra a clientes internacionales en stablecoins.

Un banco o entidad regulada explora depósitos o pagos con stablecoins de forma controlada.

Una empresa paga proveedores en USDC usando treasury payouts.

Un comercio acepta USDC y recibe settlement fiat simulado o real vía partner.

Una institución quiere reportes auditables de sus operaciones cripto.

La visión de largo plazo de AvaSettle es convertirse en un proveedor de infraestructura para stablecoin payments institucionales en LATAM.

El roadmap natural sería:

Migrar de JSON storage a PostgreSQL/Firebase SQL Connect.

Completar sweep automático de pay-ins hacia treasury.

Desplegar el backend en cloud.

Agregar dashboard para instituciones.

Integrar Wavy Node o proveedor real de risk/AML.

Integrar Fireblocks, KMS, HSM o custodia institucional para firma.

Completar PaymentRouter y deployarlo en Avalanche.

Explorar eERC para pagos privados empresariales.

Agregar webhooks para empresas.

Agregar soporte multi-merchant.

Agregar soporte multi-asset y multi-chain.

Agregar conciliación contable/exportable.

Agregar integración con fiat/off-ramp partners.

Agregar reportes financieros y operativos más avanzados.

El estado actual de AvaSettle puede describirse como un MVP técnico y conceptual muy fuerte, con backend/API, módulos principales, documentación y una narrativa de negocio validada por el reconocimiento Top 5. Todavía no es producción; faltan despliegue robusto, base de datos real, sweep completo, integración de riesgo real, KYC/AML real, smart contract final y dashboard. Pero como base de producto, ya tiene una dirección clara.

La frase más importante para recordar es:

AvaSettle no intenta reemplazar a las instituciones financieras. Les da la infraestructura para operar stablecoins de forma institucional.

Otra frase clave:

Publicar una wallet no es infraestructura financiera.

Y otra:

AvaSettle transforma una transferencia de USDC en una operación conciliable, auditable y liquidable.

El proyecto también tuvo un valor personal importante: nació de una observación real sobre cómo las instituciones financieras podrían operar stablecoins, se transformó en una propuesta técnica concreta, fue desarrollado en condiciones limitadas, llegó a una hackathon institucional de Avalanche, y aun sin una demo perfecta logró quedar Top 5. Eso valida que la idea tiene peso, especialmente por su enfoque institucional y no retail.

AvaSettle es potente porque no se queda en “cripto por cripto”. Habla el lenguaje de empresas: pagos, conciliación, tesorería, liquidación, riesgo, auditoría, reportes e integración.

El proyecto puede presentarse como:

Una API B2B de stablecoin payments.

Un proveedor blockchain para instituciones.

Una capa de settlement con USDC sobre Avalanche.

Un motor de conciliación on-chain.

Una infraestructura para pay-ins y payouts.

Un puente entre cripto y operación financiera institucional.

Una base para futuros productos financieros con stablecoins en LATAM.

En resumen:

AvaSettle es una infraestructura B2B para que empresas financieras de LATAM puedan recibir, conciliar, liquidar y enviar pagos con stablecoins sobre Avalanche. Su core es el pay-in: permitir que clientes paguen en USDC y que la empresa sepa automáticamente si pagaron, cuánto pagaron y cómo se liquida esa operación. Complementa eso con payouts desde treasury, settlement fiat simulado, reportes, riesgo, adapters empresariales, smart contracts programables y un roadmap hacia privacidad con eERC. Fue desarrollado durante la Hackathon LatAm Institucional de Avalanche, quedó en el Top 5 y recibió un premio de 300 USD, demostrando que la idea tiene fuerza, relevancia institucional y potencial de mercado.
