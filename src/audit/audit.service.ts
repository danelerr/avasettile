import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditActor, AuditEvent, AuditEventType } from './audit.types';

@Injectable()
export class AuditService {
  private readonly events: AuditEvent[] = [];

  record(input: {
    type: AuditEventType;
    subjectId: string;
    actor: AuditActor;
    payload?: Record<string, unknown>;
  }): AuditEvent {
    const event: AuditEvent = {
      id: randomUUID(),
      type: input.type,
      subjectId: input.subjectId,
      actor: input.actor,
      payload: input.payload ?? {},
      createdAt: new Date().toISOString(),
    };

    this.events.push(event);
    return event;
  }

  listBySubject(subjectId: string): AuditEvent[] {
    return this.events.filter((event) => event.subjectId === subjectId);
  }
}
