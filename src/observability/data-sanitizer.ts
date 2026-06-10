// Data masking for structured logs: wipe sensitive fields, partially mask card numbers.

const DEFAULT_WIPED_KEYS = new Set([
  'password',
  'accesstoken',
  'clave',
  'pass',
  'certificatepassword',
  'certificate',
  'secret',
  'newpassword',
  'connection-string',
  'access_token',
  'apikey',
  'authorization',
  'file',
  'databinario',
  'base64',
  'contract',
  'client_secret',
]);

const DEFAULT_PROTECTED_KEYS = new Set([
  'td',
  'nrotarjeta',
  'track1',
  'track2',
  'cvc',
  'cvv2',
  'numero',
  'card_number',
  'security_code',
  'number',
  'numerotarjeta',
]);

function extraKeys(envVar: string): string[] {
  return (process.env[envVar] ?? '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

function wipedKeys(): Set<string> {
  const extra = [
    ...extraKeys('LOGGING_WIPED_KEYS'),
    ...extraKeys('MIDD_LOG_SENSITIVE_JSON_KEYS'),
  ];
  if (!extra.length) return DEFAULT_WIPED_KEYS;
  return new Set([...DEFAULT_WIPED_KEYS, ...extra]);
}

function protectedKeys(): Set<string> {
  const extra = extraKeys('LOGGING_PROTECTED_KEYS');
  if (!extra.length) return DEFAULT_PROTECTED_KEYS;
  return new Set([...DEFAULT_PROTECTED_KEYS, ...extra]);
}

/**
 * Algoritmo 3: Enmascaramiento parcial para números de tarjeta y tracks.
 * Mantiene visibles los primeros 6 y últimos 4 caracteres del bloque principal.
 */
export function protect(value: string): string {
  if (value.length <= 6) return value;

  // Detecta separadores de banda magnética: =, ^, D
  const sepIdx = value.search(/[=^D]/);
  const mainBlock = sepIdx > 0 ? value.slice(0, sepIdx) : value;
  const suffix = sepIdx > 0 ? value.slice(sepIdx) : '';

  const visibleStart = 6;
  const visibleEnd = 4;
  if (mainBlock.length <= visibleStart + visibleEnd) return value;

  return (
    mainBlock.slice(0, visibleStart) +
    '_'.repeat(mainBlock.length - visibleStart - visibleEnd) +
    mainBlock.slice(-visibleEnd) +
    suffix
  );
}

/**
 * Algoritmo 1: Wiping recursivo en JSON.
 * Soporta objetos anidados, arrays y formateo de floats.
 */
export function sanitizeJson(input: unknown): unknown {
  if (input === null || input === undefined) return input;

  if (typeof input === 'number' && !Number.isInteger(input)) {
    return input.toFixed(2);
  }

  if (typeof input !== 'object') return input;

  const wiped = wipedKeys();
  const protected_ = protectedKeys();

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeJson(item));
  }

  const obj = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lk = key.toLowerCase();
    if (wiped.has(lk)) {
      result[key] = '[WIPED]';
    } else if (protected_.has(lk)) {
      result[key] = typeof value === 'string' ? protect(value) : value;
    } else {
      result[key] = sanitizeJson(value);
    }
  }

  return result;
}

/**
 * Algoritmo 2: Wiping en query strings y cuerpos x-www-form-urlencoded.
 */
export function sanitizeQueryString(input: string): string {
  const wiped = wipedKeys();
  const protected_ = protectedKeys();

  return input.replace(/([^&=]+)=([^&]*)/g, (_, key: string, value: string) => {
    const lk = key.toLowerCase();
    if (wiped.has(lk)) return `${key}=[WIPED]`;
    if (protected_.has(lk))
      return `${key}=${protect(decodeURIComponent(value))}`;
    return `${key}=${value}`;
  });
}
