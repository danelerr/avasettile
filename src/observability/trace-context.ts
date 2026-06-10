import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID } from 'node:crypto';

export type TraceContext = {
  traceId: string;
  spanId: string;
  requestID: string;
  requestIDInternal: string;
  outboundCallCounter: number;
};

export const traceStore = new AsyncLocalStorage<TraceContext>();

export function currentTrace(): TraceContext {
  return (
    traceStore.getStore() ?? {
      traceId: randomBytes(16).toString('hex'),
      spanId: randomBytes(8).toString('hex'),
      requestID: randomUUID(),
      requestIDInternal: randomUUID(),
      outboundCallCounter: 0,
    }
  );
}

export function parseTraceparent(
  header: string,
): Pick<TraceContext, 'traceId' | 'spanId'> | null {
  // W3C traceparent: 00-{traceId}-{parentId}-{flags}
  const parts = header.split('-');
  if (parts.length < 3 || parts[0] !== '00') return null;
  return {
    traceId: parts[1] ?? randomBytes(16).toString('hex'),
    spanId: parts[2] ?? randomBytes(8).toString('hex'),
  };
}
