import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export enum PayinMode {
  deposit_address = "deposit_address",
  payment_router = "payment_router",
  eerc_private = "eerc_private",
};

export enum PayinStatus {
  pending = "pending",
  detected = "detected",
  confirmed = "confirmed",
  underpaid = "underpaid",
  overpaid = "overpaid",
  expired = "expired",
  sweep_pending = "sweep_pending",
  sweep_submitted = "sweep_submitted",
  sweep_confirmed = "sweep_confirmed",
  sweep_failed = "sweep_failed",
  failed = "failed",
};

export enum PayoutStatus {
  prepared = "prepared",
  authorized = "authorized",
  broadcasted = "broadcasted",
  confirmed = "confirmed",
  failed = "failed",
  canceled = "canceled",
  needs_review = "needs_review",
};

export enum SettlementSourceType {
  payin = "payin",
  payout = "payout",
  manual = "manual",
  router_payin = "router_payin",
  eerc_private_payment = "eerc_private_payment",
};

export enum SettlementStatus {
  pending = "pending",
  completed = "completed",
  failed = "failed",
  canceled = "canceled",
};



export interface Asset_Key {
  id: UUIDString;
  __typename?: 'Asset_Key';
}

export interface AuditEvent_Key {
  id: UUIDString;
  __typename?: 'AuditEvent_Key';
}

export interface CreatePayinIntentData {
  payinIntent_insert: PayinIntent_Key;
}

export interface CreatePayinIntentVariables {
  externalId?: string | null;
  invoiceId?: string | null;
  mode: PayinMode;
  network: string;
  chainId: number;
  asset: string;
  tokenAddress?: string | null;
  decimals: number;
  amountExpected: number;
  amountExpectedAtomic: string;
  depositAddress?: string | null;
  derivationAccount?: number | null;
  derivationIndex?: Int64String | null;
  startBlock?: Int64String | null;
  expiresAt?: TimestampString | null;
  metadata: unknown;
}

export interface CreatePayoutRequestData {
  payoutRequest_insert: PayoutRequest_Key;
}

export interface CreatePayoutRequestVariables {
  externalId: string;
  chainFlowExternalTx?: string | null;
  chainFlowRetiroPago?: Int64String | null;
  chainFlowTransferBlock?: Int64String | null;
  chainFlowPaymentProcessor?: Int64String | null;
  chainFlowCurrencyCode?: Int64String | null;
  network: string;
  chainId: number;
  asset: string;
  tokenAddress?: string | null;
  decimals: number;
  amount: number;
  amountAtomic: string;
  beneficiaryAddress: string;
  beneficiaryName?: string | null;
  treasuryAddress?: string | null;
  preparedAt?: TimestampString | null;
  metadata: unknown;
}

export interface CreateSettlementData {
  settlement_insert: Settlement_Key;
}

export interface CreateSettlementVariables {
  sourceType: SettlementSourceType;
  sourceId?: UUIDString | null;
  asset: string;
  grossAmount: number;
  feeBps: number;
  feeAmount: number;
  netAmount: number;
  fiatCurrency: string;
  fxRate: number;
  fiatAmount: number;
  payoutRequestId?: UUIDString | null;
  payinIntentId?: UUIDString | null;
  metadata: unknown;
}

export interface GetAvaSettleSummaryData {
  avaSettleSummaries: ({
    totalPayins?: number | null;
    confirmedPayins?: number | null;
    totalPayouts?: number | null;
    confirmedPayouts?: number | null;
    totalSettlements?: number | null;
    completedSettlements?: number | null;
  })[];
}

export interface GetPayinByIdData {
  payinIntent?: {
    id: UUIDString;
    externalId?: string | null;
    invoiceId?: string | null;
    mode: PayinMode;
    status: PayinStatus;
    asset: string;
    amountExpected: number;
    amountDetected?: number | null;
    depositAddress?: string | null;
    payerAddress?: string | null;
    paidTxHash?: string | null;
    paidBlockNumber?: Int64String | null;
    sweepDestination?: string | null;
    sweepTxHash?: string | null;
    sweepBlockNumber?: Int64String | null;
    metadata: unknown;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & PayinIntent_Key;
}

export interface GetPayinByIdVariables {
  id: UUIDString;
}

export interface GetPayoutByExternalIdData {
  payoutRequests: ({
    id: UUIDString;
    externalId: string;
    status: PayoutStatus;
    amount: number;
    beneficiaryAddress: string;
    transactionHash?: string | null;
    blockNumber?: Int64String | null;
    confirmations?: number | null;
    errorMessage?: string | null;
    preparedAt?: TimestampString | null;
    authorizedAt?: TimestampString | null;
    broadcastedAt?: TimestampString | null;
    confirmedAt?: TimestampString | null;
    failedAt?: TimestampString | null;
  } & PayoutRequest_Key)[];
}

export interface GetPayoutByExternalIdVariables {
  externalId: string;
}

export interface Institution_Key {
  id: UUIDString;
  __typename?: 'Institution_Key';
}

export interface ListAuditEventsForSubjectData {
  auditEvents: ({
    id: UUIDString;
    actorType: string;
    actorId?: string | null;
    subjectType: string;
    subjectId?: UUIDString | null;
    eventType: string;
    payload: unknown;
    correlationId?: string | null;
    createdAt: TimestampString;
  } & AuditEvent_Key)[];
}

export interface ListAuditEventsForSubjectVariables {
  subjectId: UUIDString;
  limit: number;
}

export interface ListRecentPayinsData {
  payinIntents: ({
    id: UUIDString;
    externalId?: string | null;
    invoiceId?: string | null;
    mode: PayinMode;
    status: PayinStatus;
    network: string;
    chainId: number;
    asset: string;
    amountExpected: number;
    amountExpectedAtomic: string;
    amountDetected?: number | null;
    depositAddress?: string | null;
    paidTxHash?: string | null;
    sweepTxHash?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & PayinIntent_Key)[];
}

export interface ListRecentPayinsVariables {
  limit: number;
}

export interface ListRecentPayoutsData {
  payoutRequests: ({
    id: UUIDString;
    externalId: string;
    chainFlowExternalTx?: string | null;
    chainFlowRetiroPago?: Int64String | null;
    chainFlowTransferBlock?: Int64String | null;
    status: PayoutStatus;
    asset: string;
    amount: number;
    amountAtomic: string;
    beneficiaryAddress: string;
    treasuryAddress?: string | null;
    transactionHash?: string | null;
    blockNumber?: Int64String | null;
    confirmations?: number | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & PayoutRequest_Key)[];
}

export interface ListRecentPayoutsVariables {
  limit: number;
}

export interface ListRecentSettlementsData {
  settlements: ({
    id: UUIDString;
    sourceType: SettlementSourceType;
    sourceId?: UUIDString | null;
    status: SettlementStatus;
    asset: string;
    grossAmount: number;
    feeBps: number;
    netAmount: number;
    fiatCurrency: string;
    fxRate: number;
    fiatAmount: number;
    completedAt?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Settlement_Key)[];
}

export interface ListRecentSettlementsVariables {
  limit: number;
}

export interface MarkPayinDetectedData {
  payinIntent_update?: PayinIntent_Key | null;
}

export interface MarkPayinDetectedVariables {
  id: UUIDString;
  status: PayinStatus;
  amountDetected: number;
  amountDetectedAtomic: string;
  payerAddress?: string | null;
  paidTxHash: string;
  paidBlockNumber: Int64String;
}

export interface MarkPayinSweepSubmittedData {
  payinIntent_update?: PayinIntent_Key | null;
}

export interface MarkPayinSweepSubmittedVariables {
  id: UUIDString;
  sweepDestination: string;
  sweepTxHash: string;
}

export interface MarkPayoutBroadcastedData {
  payoutRequest_update?: PayoutRequest_Key | null;
}

export interface MarkPayoutBroadcastedVariables {
  id: UUIDString;
  transactionHash: string;
  treasuryAddress?: string | null;
  broadcastedAt?: TimestampString | null;
}

export interface Merchant_Key {
  id: UUIDString;
  __typename?: 'Merchant_Key';
}

export interface PayinIntent_Key {
  id: UUIDString;
  __typename?: 'PayinIntent_Key';
}

export interface PaymentRouterIntent_Key {
  id: UUIDString;
  __typename?: 'PaymentRouterIntent_Key';
}

export interface PayoutRequest_Key {
  id: UUIDString;
  __typename?: 'PayoutRequest_Key';
}

export interface RecordAuditEventData {
  auditEvent_insert: AuditEvent_Key;
}

export interface RecordAuditEventVariables {
  actorType: string;
  actorId?: string | null;
  subjectType: string;
  subjectId?: UUIDString | null;
  eventType: string;
  payload: unknown;
  correlationId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
}

export interface RiskAssessment_Key {
  id: UUIDString;
  __typename?: 'RiskAssessment_Key';
}

export interface Settlement_Key {
  id: UUIDString;
  __typename?: 'Settlement_Key';
}

export interface TreasuryWallet_Key {
  id: UUIDString;
  __typename?: 'TreasuryWallet_Key';
}

interface CreatePayinIntentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePayinIntentVariables): MutationRef<CreatePayinIntentData, CreatePayinIntentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreatePayinIntentVariables): MutationRef<CreatePayinIntentData, CreatePayinIntentVariables>;
  operationName: string;
}
export const createPayinIntentRef: CreatePayinIntentRef;

export function createPayinIntent(vars: CreatePayinIntentVariables): MutationPromise<CreatePayinIntentData, CreatePayinIntentVariables>;
export function createPayinIntent(dc: DataConnect, vars: CreatePayinIntentVariables): MutationPromise<CreatePayinIntentData, CreatePayinIntentVariables>;

interface MarkPayinDetectedRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkPayinDetectedVariables): MutationRef<MarkPayinDetectedData, MarkPayinDetectedVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkPayinDetectedVariables): MutationRef<MarkPayinDetectedData, MarkPayinDetectedVariables>;
  operationName: string;
}
export const markPayinDetectedRef: MarkPayinDetectedRef;

export function markPayinDetected(vars: MarkPayinDetectedVariables): MutationPromise<MarkPayinDetectedData, MarkPayinDetectedVariables>;
export function markPayinDetected(dc: DataConnect, vars: MarkPayinDetectedVariables): MutationPromise<MarkPayinDetectedData, MarkPayinDetectedVariables>;

interface MarkPayinSweepSubmittedRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkPayinSweepSubmittedVariables): MutationRef<MarkPayinSweepSubmittedData, MarkPayinSweepSubmittedVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkPayinSweepSubmittedVariables): MutationRef<MarkPayinSweepSubmittedData, MarkPayinSweepSubmittedVariables>;
  operationName: string;
}
export const markPayinSweepSubmittedRef: MarkPayinSweepSubmittedRef;

export function markPayinSweepSubmitted(vars: MarkPayinSweepSubmittedVariables): MutationPromise<MarkPayinSweepSubmittedData, MarkPayinSweepSubmittedVariables>;
export function markPayinSweepSubmitted(dc: DataConnect, vars: MarkPayinSweepSubmittedVariables): MutationPromise<MarkPayinSweepSubmittedData, MarkPayinSweepSubmittedVariables>;

interface CreatePayoutRequestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePayoutRequestVariables): MutationRef<CreatePayoutRequestData, CreatePayoutRequestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreatePayoutRequestVariables): MutationRef<CreatePayoutRequestData, CreatePayoutRequestVariables>;
  operationName: string;
}
export const createPayoutRequestRef: CreatePayoutRequestRef;

export function createPayoutRequest(vars: CreatePayoutRequestVariables): MutationPromise<CreatePayoutRequestData, CreatePayoutRequestVariables>;
export function createPayoutRequest(dc: DataConnect, vars: CreatePayoutRequestVariables): MutationPromise<CreatePayoutRequestData, CreatePayoutRequestVariables>;

interface MarkPayoutBroadcastedRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkPayoutBroadcastedVariables): MutationRef<MarkPayoutBroadcastedData, MarkPayoutBroadcastedVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkPayoutBroadcastedVariables): MutationRef<MarkPayoutBroadcastedData, MarkPayoutBroadcastedVariables>;
  operationName: string;
}
export const markPayoutBroadcastedRef: MarkPayoutBroadcastedRef;

export function markPayoutBroadcasted(vars: MarkPayoutBroadcastedVariables): MutationPromise<MarkPayoutBroadcastedData, MarkPayoutBroadcastedVariables>;
export function markPayoutBroadcasted(dc: DataConnect, vars: MarkPayoutBroadcastedVariables): MutationPromise<MarkPayoutBroadcastedData, MarkPayoutBroadcastedVariables>;

interface CreateSettlementRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSettlementVariables): MutationRef<CreateSettlementData, CreateSettlementVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateSettlementVariables): MutationRef<CreateSettlementData, CreateSettlementVariables>;
  operationName: string;
}
export const createSettlementRef: CreateSettlementRef;

export function createSettlement(vars: CreateSettlementVariables): MutationPromise<CreateSettlementData, CreateSettlementVariables>;
export function createSettlement(dc: DataConnect, vars: CreateSettlementVariables): MutationPromise<CreateSettlementData, CreateSettlementVariables>;

interface RecordAuditEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RecordAuditEventVariables): MutationRef<RecordAuditEventData, RecordAuditEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RecordAuditEventVariables): MutationRef<RecordAuditEventData, RecordAuditEventVariables>;
  operationName: string;
}
export const recordAuditEventRef: RecordAuditEventRef;

export function recordAuditEvent(vars: RecordAuditEventVariables): MutationPromise<RecordAuditEventData, RecordAuditEventVariables>;
export function recordAuditEvent(dc: DataConnect, vars: RecordAuditEventVariables): MutationPromise<RecordAuditEventData, RecordAuditEventVariables>;

interface GetAvaSettleSummaryRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetAvaSettleSummaryData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetAvaSettleSummaryData, undefined>;
  operationName: string;
}
export const getAvaSettleSummaryRef: GetAvaSettleSummaryRef;

export function getAvaSettleSummary(options?: ExecuteQueryOptions): QueryPromise<GetAvaSettleSummaryData, undefined>;
export function getAvaSettleSummary(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetAvaSettleSummaryData, undefined>;

interface ListRecentPayinsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListRecentPayinsVariables): QueryRef<ListRecentPayinsData, ListRecentPayinsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListRecentPayinsVariables): QueryRef<ListRecentPayinsData, ListRecentPayinsVariables>;
  operationName: string;
}
export const listRecentPayinsRef: ListRecentPayinsRef;

export function listRecentPayins(vars: ListRecentPayinsVariables, options?: ExecuteQueryOptions): QueryPromise<ListRecentPayinsData, ListRecentPayinsVariables>;
export function listRecentPayins(dc: DataConnect, vars: ListRecentPayinsVariables, options?: ExecuteQueryOptions): QueryPromise<ListRecentPayinsData, ListRecentPayinsVariables>;

interface GetPayinByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPayinByIdVariables): QueryRef<GetPayinByIdData, GetPayinByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetPayinByIdVariables): QueryRef<GetPayinByIdData, GetPayinByIdVariables>;
  operationName: string;
}
export const getPayinByIdRef: GetPayinByIdRef;

export function getPayinById(vars: GetPayinByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetPayinByIdData, GetPayinByIdVariables>;
export function getPayinById(dc: DataConnect, vars: GetPayinByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetPayinByIdData, GetPayinByIdVariables>;

interface ListRecentPayoutsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListRecentPayoutsVariables): QueryRef<ListRecentPayoutsData, ListRecentPayoutsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListRecentPayoutsVariables): QueryRef<ListRecentPayoutsData, ListRecentPayoutsVariables>;
  operationName: string;
}
export const listRecentPayoutsRef: ListRecentPayoutsRef;

export function listRecentPayouts(vars: ListRecentPayoutsVariables, options?: ExecuteQueryOptions): QueryPromise<ListRecentPayoutsData, ListRecentPayoutsVariables>;
export function listRecentPayouts(dc: DataConnect, vars: ListRecentPayoutsVariables, options?: ExecuteQueryOptions): QueryPromise<ListRecentPayoutsData, ListRecentPayoutsVariables>;

interface GetPayoutByExternalIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPayoutByExternalIdVariables): QueryRef<GetPayoutByExternalIdData, GetPayoutByExternalIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetPayoutByExternalIdVariables): QueryRef<GetPayoutByExternalIdData, GetPayoutByExternalIdVariables>;
  operationName: string;
}
export const getPayoutByExternalIdRef: GetPayoutByExternalIdRef;

export function getPayoutByExternalId(vars: GetPayoutByExternalIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetPayoutByExternalIdData, GetPayoutByExternalIdVariables>;
export function getPayoutByExternalId(dc: DataConnect, vars: GetPayoutByExternalIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetPayoutByExternalIdData, GetPayoutByExternalIdVariables>;

interface ListRecentSettlementsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListRecentSettlementsVariables): QueryRef<ListRecentSettlementsData, ListRecentSettlementsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListRecentSettlementsVariables): QueryRef<ListRecentSettlementsData, ListRecentSettlementsVariables>;
  operationName: string;
}
export const listRecentSettlementsRef: ListRecentSettlementsRef;

export function listRecentSettlements(vars: ListRecentSettlementsVariables, options?: ExecuteQueryOptions): QueryPromise<ListRecentSettlementsData, ListRecentSettlementsVariables>;
export function listRecentSettlements(dc: DataConnect, vars: ListRecentSettlementsVariables, options?: ExecuteQueryOptions): QueryPromise<ListRecentSettlementsData, ListRecentSettlementsVariables>;

interface ListAuditEventsForSubjectRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListAuditEventsForSubjectVariables): QueryRef<ListAuditEventsForSubjectData, ListAuditEventsForSubjectVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListAuditEventsForSubjectVariables): QueryRef<ListAuditEventsForSubjectData, ListAuditEventsForSubjectVariables>;
  operationName: string;
}
export const listAuditEventsForSubjectRef: ListAuditEventsForSubjectRef;

export function listAuditEventsForSubject(vars: ListAuditEventsForSubjectVariables, options?: ExecuteQueryOptions): QueryPromise<ListAuditEventsForSubjectData, ListAuditEventsForSubjectVariables>;
export function listAuditEventsForSubject(dc: DataConnect, vars: ListAuditEventsForSubjectVariables, options?: ExecuteQueryOptions): QueryPromise<ListAuditEventsForSubjectData, ListAuditEventsForSubjectVariables>;

