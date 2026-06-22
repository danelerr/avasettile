export type AuditEventType =
  | 'PAYOUT_PREPARED'
  | 'PAYOUT_IDEMPOTENT_REPLAY'
  | 'PAYOUT_AUTHORIZED'
  | 'PAYOUT_BROADCASTED'
  | 'PAYOUT_CONFIRMED'
  | 'PAYOUT_FAILED'
  | 'PAYOUT_RECONCILED'
  | 'PAYIN_CREATED'
  | 'PAYIN_RECONCILED'
  | 'PAYIN_SWEPT'
  | 'PAYIN_SWEEP_FAILED'
  | 'PAYIN_ACCEPTED'
  | 'PAYIN_TOPUP'
  | 'PRIVATE_SETTLEMENT_RECORDED'
  | 'PRIVATE_SETTLEMENT_REVEALED';

export type AuditActor = {
  clientId: string | null;
  actor: string | null;
  correlationId: string | null;
  sourceIp: string | null;
};

export type AuditEvent = {
  id: string;
  clientId: string | null;
  type: AuditEventType;
  subjectId: string;
  actor: AuditActor;
  payload: Record<string, unknown>;
  createdAt: string;
};
