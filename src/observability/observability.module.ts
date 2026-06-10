import { Global, Module } from '@nestjs/common';
import { ApiRequestMiddleware } from './api-request.middleware';
import { OutboundHttpLogger } from './outbound-http-logger';
import { TraceMiddleware } from './trace.middleware';

@Global()
@Module({
  providers: [TraceMiddleware, ApiRequestMiddleware, OutboundHttpLogger],
  exports: [OutboundHttpLogger],
})
export class ObservabilityModule {}
