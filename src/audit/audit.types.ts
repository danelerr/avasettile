export type AuditEventType =
  | 'PAYOUT_PREPARED'
  | 'PAYOUT_IDEMPOTENT_REPLAY'
  | 'PAYOUT_AUTHORIZED'
  | 'PAYOUT_BROADCASTED'
  | 'PAYOUT_CONFIRMED'
  | 'PAYOUT_FAILED'
  | 'PAYOUT_RECONCILED';

export type AuditActor = {
  institutionId: string | null;
  actor: string | null;
  correlationId: string | null;
  sourceIp: string | null;
};

export type AuditEvent = {
  id: string;
  type: AuditEventType;
  subjectId: string;
  actor: AuditActor;
  payload: Record<string, unknown>;
  createdAt: string;
};
