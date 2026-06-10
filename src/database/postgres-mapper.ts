import type { AuditEvent, AuditActor } from '../audit/audit.types';
import type {
  PayInCollectionMode,
  PayInRecord,
  PayInSweepStatus,
  PayInStatus,
  PayInTransferRecord,
} from '../payins/payins.types';
import type { PayoutRecord, PayoutStatus } from '../payouts/payout.types';
import type { PrivateSettlementRecord } from '../privacy/privacy.types';
import type { SettlementRecord, SettlementStatus } from '../settlement/settlement.types';
import type { SettlementAsset, SettlementNetwork } from '../configuration/configuration.types';

type Row = Record<string, unknown>;

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return new Date(v).toISOString();
  return null;
}

function requireIso(v: unknown): string {
  return toIso(v) ?? new Date().toISOString();
}

// ─── PayIn ────────────────────────────────────────────────────────────────────

export function rowToPayIn(row: Row): PayInRecord {
  return {
    id: row['id'] as string,
    externalId: row['external_id'] as string,
    chainFlowRequestId: (row['chain_flow_request_id'] as string | null) ?? null,
    status: row['status'] as PayInStatus,
    network: row['network'] as SettlementNetwork,
    chainId: Number(row['chain_id']),
    asset: row['asset'] as SettlementAsset,
    tokenAddress: row['token_address'] as `0x${string}`,
    collectionMode: row['collection_mode'] as PayInCollectionMode,
    depositAddress: row['deposit_address'] as `0x${string}`,
    derivationIndex: Number(row['derivation_index']),
    routerAddress: (row['router_address'] as `0x${string}` | null) ?? null,
    routerInvoiceId: (row['router_invoice_id'] as `0x${string}` | null) ?? null,
    expectedAmount: row['expected_amount'] as string,
    expectedAmountAtomic: row['expected_amount_atomic'] as string,
    receivedAmount: row['received_amount'] as string,
    receivedAmountAtomic: row['received_amount_atomic'] as string,
    sweepStatus: row['sweep_status'] as PayInSweepStatus,
    sweepTransactionHash: (row['sweep_tx_hash'] as `0x${string}` | null) ?? null,
    sweptAmount: row['swept_amount'] as string,
    sweptAmountAtomic: row['swept_amount_atomic'] as string,
    sweptAt: toIso(row['swept_at']),
    sweepFailureReason: (row['sweep_failure_reason'] as string | null) ?? null,
    startBlock: row['start_block'] as string,
    expiresAt: toIso(row['expires_at']),
    acceptedAt: toIso(row['accepted_at']),
    acceptanceNote: (row['acceptance_note'] as string | null) ?? null,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    transfers: (row['transfers'] as PayInTransferRecord[]) ?? [],
    detectedAt: toIso(row['detected_at']),
    confirmedAt: toIso(row['confirmed_at']),
    createdAt: requireIso(row['created_at']),
    updatedAt: requireIso(row['updated_at']),
  };
}

export function payInToValues(p: PayInRecord): unknown[] {
  return [
    p.id,
    p.externalId,
    p.chainFlowRequestId,
    p.status,
    p.network,
    p.chainId,
    p.asset,
    p.tokenAddress,
    p.collectionMode,
    p.depositAddress,
    p.derivationIndex,
    p.routerAddress,
    p.routerInvoiceId,
    p.expectedAmount,
    p.expectedAmountAtomic,
    p.receivedAmount,
    p.receivedAmountAtomic,
    p.sweepStatus,
    p.sweepTransactionHash,
    p.sweptAmount,
    p.sweptAmountAtomic,
    p.sweptAt ?? null,
    p.sweepFailureReason,
    p.startBlock,
    p.expiresAt ?? null,
    p.acceptedAt ?? null,
    p.acceptanceNote,
    JSON.stringify(p.metadata),
    JSON.stringify(p.transfers),
    p.detectedAt ?? null,
    p.confirmedAt ?? null,
    p.createdAt,
    p.updatedAt,
  ];
}

// ─── Payout ───────────────────────────────────────────────────────────────────

export function rowToPayout(row: Row): PayoutRecord {
  return {
    id: row['id'] as string,
    externalId: row['external_id'] as string,
    chainFlowRequestId: (row['chain_flow_request_id'] as string | null) ?? null,
    status: row['status'] as PayoutStatus,
    network: row['network'] as SettlementNetwork,
    chainId: Number(row['chain_id']),
    asset: row['asset'] as SettlementAsset,
    tokenAddress: row['token_address'] as `0x${string}`,
    amount: row['amount'] as string,
    amountAtomic: row['amount_atomic'] as string,
    beneficiaryAddress: row['beneficiary_address'] as `0x${string}`,
    beneficiaryName: (row['beneficiary_name'] as string | null) ?? null,
    treasuryAddress: (row['treasury_address'] as `0x${string}` | null) ?? null,
    transactionHash: (row['transaction_hash'] as `0x${string}` | null) ?? null,
    failureReason: (row['failure_reason'] as string | null) ?? null,
    memo: (row['memo'] as string | null) ?? null,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    authorizedAt: toIso(row['authorized_at']),
    broadcastedAt: toIso(row['broadcasted_at']),
    confirmedAt: toIso(row['confirmed_at']),
    createdAt: requireIso(row['created_at']),
    updatedAt: requireIso(row['updated_at']),
  };
}

export function payoutToValues(p: PayoutRecord): unknown[] {
  return [
    p.id,
    p.externalId,
    p.chainFlowRequestId,
    p.status,
    p.network,
    p.chainId,
    p.asset,
    p.tokenAddress,
    p.amount,
    p.amountAtomic,
    p.beneficiaryAddress,
    p.beneficiaryName,
    p.treasuryAddress,
    p.transactionHash,
    p.failureReason,
    p.memo,
    JSON.stringify(p.metadata),
    p.authorizedAt ?? null,
    p.broadcastedAt ?? null,
    p.confirmedAt ?? null,
    p.createdAt,
    p.updatedAt,
  ];
}

// ─── AuditEvent ───────────────────────────────────────────────────────────────

export function rowToAuditEvent(row: Row): AuditEvent {
  return {
    id: row['id'] as string,
    type: row['type'] as AuditEvent['type'],
    subjectId: row['subject_id'] as string,
    actor: (row['actor'] as AuditActor) ?? {},
    payload: (row['payload'] as Record<string, unknown>) ?? {},
    createdAt: requireIso(row['created_at']),
  };
}

export function auditEventToValues(e: AuditEvent): unknown[] {
  return [e.id, e.type, e.subjectId, JSON.stringify(e.actor), JSON.stringify(e.payload), e.createdAt];
}

// ─── Settlement ───────────────────────────────────────────────────────────────

export function rowToSettlement(row: Row): SettlementRecord {
  return {
    id: row['id'] as string,
    sourceType: (row['source_type'] as SettlementRecord['sourceType']) ?? 'manual',
    sourceId: (row['source_id'] as string) ?? '',
    status: row['status'] as SettlementStatus,
    asset: row['asset'] as SettlementAsset,
    cryptoAmount: row['crypto_amount'] as string,
    fiatCurrency: row['fiat_currency'] as string,
    fiatAmount: row['fiat_amount'] as string,
    fxRate: row['fx_rate'] as string,
    rail: (row['rail'] as string) ?? 'simulated-fiat-rail',
    reference: (row['reference'] as string | null) ?? null,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    completedAt: toIso(row['completed_at']),
    failureReason: (row['failure_reason'] as string | null) ?? null,
    createdAt: requireIso(row['created_at']),
    updatedAt: requireIso(row['updated_at']),
  };
}

export function settlementToValues(s: SettlementRecord): unknown[] {
  return [
    s.id,
    s.sourceType,
    s.sourceId,
    s.status,
    s.asset,
    s.cryptoAmount,
    s.fiatCurrency,
    s.fiatAmount,
    s.fxRate,
    s.rail,
    s.reference,
    JSON.stringify(s.metadata),
    s.completedAt ?? null,
    s.failureReason,
    s.createdAt,
    s.updatedAt,
  ];
}

// ─── PrivateSettlement ────────────────────────────────────────────────────────

export function rowToPrivateSettlement(row: Row): PrivateSettlementRecord {
  return {
    id: row['id'] as string,
    externalId: row['external_id'] as string,
    mode: row['mode'] as PrivateSettlementRecord['mode'],
    status: row['status'] as PrivateSettlementRecord['status'],
    subjectType: row['subject_type'] as PrivateSettlementRecord['subjectType'],
    subjectId: (row['subject_id'] as string | null) ?? null,
    asset: row['asset'] as SettlementAsset,
    publicAmount: (row['public_amount'] as string | null) ?? null,
    amountCommitment: row['amount_commitment'] as string,
    counterpartyCommitment: (row['counterparty_commitment'] as string | null) ?? null,
    metadataHash: row['metadata_hash'] as string,
    eercContractAddress: (row['eerc_contract_address'] as `0x${string}` | null) ?? null,
    createdAt: requireIso(row['created_at']),
    updatedAt: requireIso(row['updated_at']),
  };
}

export function privateSettlementToValues(ps: PrivateSettlementRecord): unknown[] {
  return [
    ps.id,
    ps.externalId,
    ps.mode,
    ps.status,
    ps.subjectType,
    ps.subjectId,
    ps.asset,
    ps.publicAmount,
    ps.amountCommitment,
    ps.counterpartyCommitment,
    ps.metadataHash,
    ps.eercContractAddress,
    ps.createdAt,
    ps.updatedAt,
  ];
}
