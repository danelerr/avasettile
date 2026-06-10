# Prompt / Especificación Técnica para Portabilidad del Módulo de Logs y Trazabilidad

Este documento contiene una especificación técnica hiperdetallada estructurada como **System Prompt** listo para ser procesado por una IA (o un ingeniero de software) con el fin de portar el sistema de logs y trazabilidad de `midd-library` a cualquier stack tecnológico (por ejemplo, NestJS/TypeScript, FastAPI/Python, Gin/Go, Express, etc.).

---

# [SYSTEM PROMPT] Instrucciones para Portar el Módulo de Logging y Trazabilidad de `midd-library`

## Objetivo
Actúas como un Ingeniero de Software Principal y Arquitecto experto en Observabilidad. Tu misión es reimplementar de manera exacta el módulo de logs y trazabilidad corporativo de `midd-library` (originalmente escrito en Java/Spring Boot) en el lenguaje y framework de destino solicitado por el usuario (por ejemplo, NestJS con Winston/Pino, FastAPI con Loguru, etc.).

Debes adherirte de forma estricta a las siguientes especificaciones técnicas, algoritmos de enmascaramiento, flujos de trazabilidad distribuida y esquemas estructurados de salida.

---

## 1. CONTROL DE TRAZABILIDAD Y PROPAGACIÓN (CORRELATION IDS)

El sistema debe gestionar y propagar tres identificadores clave a través de un contexto de almacenamiento de subprocesos o hilos locales (como `AsyncLocalStorage` en Node.js, `context` en Go, o `contextvars` en Python):

1. **`traceId` / `spanId`**: Identificadores de telemetría distribuida nativos de la plataforma o APM (OpenTelemetry/Sleuth). Si no se integran de forma nativa, deben leerse de la infraestructura o autogenerarse.
2. **`requestID` (Cabecera: `X-Request-ID`)**: El identificador global de la transacción provisto por el API Gateway o el cliente.
3. **`requestIDInternal`**: Un identificador único autogenerado localmente (`UUID v4`) en cada hilo de petición para aislar depuraciones en el microservicio actual.

### Algoritmo del Middleware / Filtro HTTP Entrante:
1. **Interceptar Petición Entrante:**
   * Leer la cabecera `X-Request-ID`.
   * Si está vacía o no existe, generar un nuevo UUIDv4. Este valor será el `requestID`.
   * Generar un segundo UUIDv4 independiente que será el `requestIDInternal`.
2. **Almacenar en Contexto:**
   * Guardar `requestID` y `requestIDInternal` en el contexto local (MDC / Async Store) asociado al hilo/petición actual.
3. **Inyectar en Respuesta:**
   * Agregar la cabecera HTTP `X-Request-ID` a la respuesta del cliente utilizando el valor establecido para `requestID`.
4. **Propagación Saliente:**
   * Registrar un interceptor para clientes HTTP salientes (como `Axios`, `Fetch` o `requests`). Este interceptor debe leer `requestID` del contexto activo e inyectarlo en la cabecera `X-Request-ID` de toda petición saliente hacia dependencias externas.

---

## 2. ESQUEMAS DE LOGS ESTRUCTURADOS (JSON)

Todos los logs deben ser impresos en consola en formato **JSON estructurado** de una sola línea (o en formato indentado/pretty-print según configuración). No utilices textos planos arbitrarios. Cada tipo de log debe mapear con exactitud los siguientes campos y en el orden de serialización especificado si el formateador JSON del lenguaje lo permite:

### A. Log de Petición Entrante/Saliente de API (`ApiRequestLog`)
Registrado al inicio y fin de cada petición HTTP en el microservicio.
* **Orden / Propiedades obligatorias:**
  1. `traceId` (String, opcional)
  2. `spanId` (String, opcional)
  3. `requestIDInternal` (String)
  4. `requestID` (String)
  5. `method` (String) - Método HTTP (GET, POST, etc.)
  6. `path` (String) - URI de la petición sin parámetros de consulta
  7. `status` (Integer) - Código de respuesta HTTP
  8. `inDate` (String/ISO DateTime) - Timestamp de entrada
  9. `outDate` (String/ISO DateTime) - Timestamp de salida
  10. `user` (String, opcional) - Identidad del usuario autenticado si aplica
  11. `headers` (String JSON) - Cabeceras de la petición formateadas como String
  12. `parameters` (String JSON, opcional) - Parámetros del Request
  13. `queryParameters` (String JSON, opcional) - Parámetros de consulta (`query`) en la URL
  14. `request` (String JSON, opcional) - Payload/Body enmascarado del Request
  15. `response` (String JSON, opcional) - Payload/Body enmascarado de la Respuesta
  16. `remoteAddress` (String) - Dirección IP del cliente

### B. Log de Cliente HTTP Integración (`ApiClientLog`)
Registrado al realizar peticiones externas hacia terceras APIs.
* **Orden / Propiedades obligatorias:**
  1. `traceId` (String, opcional)
  2. `spanId` (String, opcional)
  3. `requestIDInternal` (String)
  4. `requestID` (String)
  5. `type` (String) - Valor fijo: `"Outbound Message"` al enviar, `"Inbound Message"` al recibir.
  6. `id` (String) - Contador o ID incremental de la petición saliente en el hilo actual.
  7. `address` (String) - URL completa destino.
  8. `method` (String) - Método HTTP de llamada externa.
  9. `responseCode` (String) - Estado HTTP retornado por el tercero (ej: `"200 OK"`).
  10. `responseText` (String, opcional) - Mensaje de estado HTTP retornado por el tercero.
  11. `headers` (String JSON) - Cabeceras de salida/entrada mapeadas.
  12. `payload` (String JSON/Plaintext, opcional) - Body enviado/recibido (enmascarado).

### C. Log de Excepciones (`ApiExceptionLog`)
Registrado de forma automática en el manejador global de excepciones (Controller Advice/Filter/Global Exception Interceptor).
* **Orden / Propiedades obligatorias:**
  1. `traceId` (String, opcional)
  2. `spanId` (String, opcional)
  3. `requestIDInternal` (String)
  4. `requestID` (String)
  5. `outDate` (String/ISO DateTime) - Timestamp del error
  6. `method` (String) - Método que falló
  7. `source` (String) - Origen del error
  8. `exceptionValue` (String) - Descripción del error o detalle serializado.

### D. Log de Kafka / Mensajería (`ApiKafkaLog`)
Registrado al consumir o producir eventos asíncronos.
* **Orden / Propiedades obligatorias:**
  1. `traceId` (String, opcional)
  2. `spanId` (String, opcional)
  3. `records` (String) - Registro/Metadatos del evento
  4. `groupId` (String) - Grupo de consumo
  5. `clientId` (String) - ID del cliente de mensajería
  6. `message` (String) - Mensaje de traza/error
  7. `data` (String JSON enmascarado) - Payload del mensaje de Kafka
  8. `inDate` (String/ISO DateTime)
  9. `outDate` (String/ISO DateTime)

---

## 3. ALGORITMOS DE ENMASCARAMIENTO Y SEGURIDAD (DATA WIPING)

Para evitar la filtración de contraseñas, tokens de autenticación o datos de tarjetas financieras en los logs, debes implementar exactamente los siguientes dos algoritmos de sanitización:

### Configuración de Claves Sensibles (Inputs de Configuración)
El sistema debe soportar tres listas dinámicas de claves (insensibles a mayúsculas/minúsculas):
1. **`Text Wiped Keys`**: Campos que deben borrarse por completo.
   * *Claves por defecto:* `password`, `accessToken`, `clave`, `pass`, `certificatePassword`, `certificate`, `secret`, `newPassword`, `connection-string`, `Connection-string`, `access_token`, `apiKey`, `Authorization`, `file`, `dataBinario`, `base64`, `contract`, `client_secret`.
2. **`Protected Keys`**: Campos que deben enmascararse parcialmente (tarjetas, tracks, CVVs).
   * *Claves por defecto:* `TD`, `nroTarjeta`, `track1`, `track2`, `cvc`, `cvv2`, `numero`, `card_number`, `security_code`, `number`, `numeroTarjeta`.
3. **`Custom Config Keys`**: Posibilidad de inyectar variables de entorno en tiempo de ejecución para ampliar ambas listas anteriores (`logging.wiped.keys`, `logging.protected.keys`, `midd.log.sensitive.json.keys`).

---

### Algoritmo 1: Wiping en JSON (Recursivo)
Recibe un objeto JSON (o su equivalente estructurado en el lenguaje destino) y aplica el procesamiento recursivo de enmascaramiento:

```text
Función sanitizarJSON(objeto):
    Para cada (clave, valor) en objeto:
        Si clave (ignorando mayúsculas/minúsculas) está en la lista de "Text Wiped Keys":
            Establecer objeto[clave] = "[WIPED]"
            
        Sino si clave (ignorando mayúsculas/minúsculas) está en la lista de "Protected Keys":
            Establecer objeto[clave] = ejecutarAlgoritmoProtect(valor)
            
        Sino si valor es un Objeto JSON:
            Llamar sanitizarJSON(valor)
            
        Sino si valor es una Lista/Array:
            Para cada elemento en valor:
                Si elemento es Objeto JSON:
                    Llamar sanitizarJSON(elemento)
                    
        Sino si valor es de tipo decimal o numérico flotante:
            Formatear valor obligatoriamente con dos decimales ("#0.00")
```

---

### Algoritmo 2: Wiping en Query Strings o Cuerpos Planos (`x-www-form-urlencoded`)
Si el contenido recibido no es JSON estructurado:
1. Buscar pares clave-valor utilizando la expresión regular: `([^&=]+)=([^&]*)`.
2. Para cada coincidencia:
   * Evaluar si la clave pertenece a `Text Wiped Keys` (reemplazar valor por `[WIPED]`).
   * Evaluar si la clave pertenece a `Protected Keys` (reemplazar valor mediante el algoritmo `Protect`).
3. Reconstruir la cadena uniendo los pares con `&`.

---

### Algoritmo 3: Enmascaramiento Parcial (`Protect`)
Este algoritmo procesa una cadena de texto (como un número de tarjeta de crédito) de la siguiente manera:
1. Si la longitud de la cadena es menor o igual a 6, devolver la cadena original intacta.
2. Si la longitud es mayor a 6:
   * Determinar el índice del carácter separador de banda o datos si existiera, buscando `=` o `^` o `D`. Si existe, calcular el rango de enmascaramiento con base a la ubicación del separador.
   * Por defecto, enmascarar los caracteres internos reemplazándolos con el carácter de guion bajo (`_`) o asterisco (`*`), manteniendo visibles los primeros **6 caracteres** y los últimos **4 caracteres** del bloque principal.
   * Retornar la cadena enmascarada conservando su longitud original.

---

## 4. SOPORTE DE CONTEXTO SIN BLOQUEO (BUFFERING)
Dado que los frameworks web consumen los flujos de lectura de red (`body streams`) al leer peticiones/respuestas, la implementación debe garantizar que:
* **Lectura no destructiva:** Se lea el cuerpo del request, se copie en un buffer intermedio en memoria para pasarlo al logger, y se reinyecte/permita que el framework continúe con su análisis sintáctico normal de parámetros sin lanzar errores de "Request stream already consumed".
* En frameworks como NestJS/Express, esto requiere middleware de captura del body (`raw-body` o caching del buffer en la petición).

---

## 5. EJEMPLO DE CÓDIGO DE ENTRADA Y SALIDA ESPERADA EN EL LOG

**Entrada original en Body (JSON):**
```json
{
  "clientName": "Juan Perez",
  "cardNumber": "4551234567890123",
  "securityCode": "123",
  "password": "miSuperClave123",
  "amount": 150.5
}
```

**Salida serializada esperada en el Log estructurado (compactada a una línea):**
```json
{"traceId":"0af7651916cd43dd8448eb211c80319c","spanId":"b7ad6b71692031a8","requestIDInternal":"2c502476-880c-48be-88e8-11f818cc63e7","requestID":"9a8b7c6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4","method":"POST","path":"/api/v1/payments","status":200,"inDate":"2026-06-09T15:34:10.123","outDate":"2026-06-09T15:34:10.512","user":"anonymous","headers":"[Accept:application/json][X-Request-ID:9a8b7c6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4]","request":"{\"clientName\":\"Juan Perez\",\"cardNumber\":\"455123______0123\",\"securityCode\":\"[WIPED]\",\"password\":\"[WIPED]\",\"amount\":\"150.50\"}","response":"{\"status\":\"SUCCESS\",\"transactionId\":\"TX-9988112\"}","remoteAddress":"192.168.1.50"}
```

---

*Por favor, genera la solución en el lenguaje o framework solicitado basándote rigurosamente en estas especificaciones.*
