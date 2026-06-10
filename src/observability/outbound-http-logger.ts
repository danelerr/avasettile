import { Injectable, Logger } from '@nestjs/common';
import { currentTrace, traceStore } from './trace-context';
import { sanitizeJson, sanitizeQueryString } from './data-sanitizer';

/**
 * Wrapper for outbound HTTP calls that emits ApiClientLog entries.
 *
 * Logs outbound and inbound HTTP calls with sanitized payloads.
 * Also propagates X-Request-ID to all outbound calls for distributed tracing.
 */
@Injectable()
export class OutboundHttpLogger {
  private readonly logger = new Logger('ApiClient');

  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const { traceId, spanId, requestID, requestIDInternal } = currentTrace();
    const store = traceStore.getStore();
    const id = store ? String(++store.outboundCallCounter) : '1';

    // Propagate X-Request-ID outbound
    const headers = new Headers(init.headers);
    headers.set('x-request-id', requestID);

    const method = (init.method ?? 'GET').toUpperCase();

    let outboundPayload: string | undefined;
    if (init.body) {
      if (typeof init.body === 'string') {
        try {
          outboundPayload = JSON.stringify(
            sanitizeJson(JSON.parse(init.body) as unknown),
          );
        } catch {
          outboundPayload = sanitizeQueryString(init.body);
        }
      } else {
        outboundPayload = '[binary]';
      }
    }

    const outboundHeaders: Record<string, string> = {};
    headers.forEach((v, k) => {
      outboundHeaders[k] = v;
    });

    this.logger.log(
      JSON.stringify({
        traceId,
        spanId,
        requestIDInternal,
        requestID,
        type: 'Outbound Message',
        id,
        address: url,
        method,
        headers: JSON.stringify(outboundHeaders),
        ...(outboundPayload !== undefined && { payload: outboundPayload }),
      }),
    );

    const response = await fetch(url, { ...init, headers });

    let inboundPayload: string | undefined;
    try {
      const cloned = response.clone();
      const text = await cloned.text();
      if (text) {
        try {
          inboundPayload = JSON.stringify(
            sanitizeJson(JSON.parse(text) as unknown),
          );
        } catch {
          inboundPayload = text.slice(0, 2_000);
        }
      }
    } catch {
      /* ignore if response body unreadable */
    }

    const inboundHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      inboundHeaders[k] = v;
    });

    this.logger.log(
      JSON.stringify({
        traceId,
        spanId,
        requestIDInternal,
        requestID,
        type: 'Inbound Message',
        id,
        address: url,
        method,
        responseCode: `${response.status} ${response.statusText}`,
        responseText: response.statusText || undefined,
        headers: JSON.stringify(inboundHeaders),
        ...(inboundPayload !== undefined && { payload: inboundPayload }),
      }),
    );

    return response;
  }
}
