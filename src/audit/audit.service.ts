import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StorageService } from '../storage/storage.service';
import { AuditActor, AuditEvent, AuditEventType } from './audit.types';

@Injectable()
export class AuditService {
  constructor(private readonly storage: StorageService) {}

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

    this.storage.update((state) => {
      state.auditEvents.push(event);
    });
    return event;
  }

  listBySubject(subjectId: string): AuditEvent[] {
    return this.storage.snapshot.auditEvents.filter(
      (event) => event.subjectId === subjectId,
    );
  }
}
