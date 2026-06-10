import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import {
  auditEventToValues,
  rowToAuditEvent,
} from '../database/postgres-mapper';
import { AuditActor, AuditEvent, AuditEventType } from './audit.types';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly database: DatabaseService) {}

  async record(input: {
    type: AuditEventType;
    subjectId: string;
    actor: AuditActor;
    payload?: Record<string, unknown>;
  }): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: randomUUID(),
      clientId: input.actor.clientId,
      type: input.type,
      subjectId: input.subjectId,
      actor: input.actor,
      payload: input.payload ?? {},
      createdAt: new Date().toISOString(),
    };

    await this.database.query(
      `INSERT INTO avasettle_audit_events (id, client_id, type, subject_id, actor, payload, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
       ON CONFLICT (id) DO NOTHING`,
      auditEventToValues(event),
    );
    return event;
  }

  async listBySubject(subjectId: string): Promise<AuditEvent[]> {
    const result = await this.database.query(
      `SELECT * FROM avasettle_audit_events
       WHERE subject_id = $1
       ORDER BY created_at ASC`,
      [subjectId],
    );
    return result.rows.map(rowToAuditEvent);
  }

  async listForTrail(filters: {
    clientId?: string;
    subjectId?: string;
    from?: string;
    to?: string;
    limit: number;
  }): Promise<AuditEvent[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const add = (clause: string, value: unknown): void => {
      values.push(value);
      conditions.push(`${clause} $${values.length}`);
    };

    if (filters.clientId) add('client_id =', filters.clientId);
    if (filters.subjectId) add('subject_id =', filters.subjectId);
    if (filters.from) add('created_at >=', filters.from);
    if (filters.to) add('created_at <=', filters.to);

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Math.min(filters.limit, 1000));

    const result = await this.database.query(
      `SELECT * FROM avasettle_audit_events
       ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length}`,
      values,
    );
    return result.rows.map(rowToAuditEvent).reverse();
  }
}
