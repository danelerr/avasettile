import { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs, makeMemoryCacheProvider } from 'firebase/data-connect';

export const PayinMode = {
  deposit_address: "deposit_address",
  payment_router: "payment_router",
  eerc_private: "eerc_private",
}

export const PayinStatus = {
  pending: "pending",
  detected: "detected",
  confirmed: "confirmed",
  underpaid: "underpaid",
  overpaid: "overpaid",
  expired: "expired",
  sweep_pending: "sweep_pending",
  sweep_submitted: "sweep_submitted",
  sweep_confirmed: "sweep_confirmed",
  sweep_failed: "sweep_failed",
  failed: "failed",
}

export const PayoutStatus = {
  prepared: "prepared",
  authorized: "authorized",
  broadcasted: "broadcasted",
  confirmed: "confirmed",
  failed: "failed",
  canceled: "canceled",
  needs_review: "needs_review",
}

export const SettlementSourceType = {
  payin: "payin",
  payout: "payout",
  manual: "manual",
  router_payin: "router_payin",
  eerc_private_payment: "eerc_private_payment",
}

export const SettlementStatus = {
  pending: "pending",
  completed: "completed",
  failed: "failed",
  canceled: "canceled",
}

export const connectorConfig = {
  connector: 'institutional',
  service: 'test-bd-9817c-service',
  location: 'us-east4'
};
export const dataConnectSettings = {
  cacheSettings: {
    cacheProvider: makeMemoryCacheProvider()
  }
};
export const createPayinIntentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePayinIntent', inputVars);
}
createPayinIntentRef.operationName = 'CreatePayinIntent';

export function createPayinIntent(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createPayinIntentRef(dcInstance, inputVars));
}

export const markPayinDetectedRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkPayinDetected', inputVars);
}
markPayinDetectedRef.operationName = 'MarkPayinDetected';

export function markPayinDetected(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markPayinDetectedRef(dcInstance, inputVars));
}

export const markPayinSweepSubmittedRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkPayinSweepSubmitted', inputVars);
}
markPayinSweepSubmittedRef.operationName = 'MarkPayinSweepSubmitted';

export function markPayinSweepSubmitted(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markPayinSweepSubmittedRef(dcInstance, inputVars));
}

export const createPayoutRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePayoutRequest', inputVars);
}
createPayoutRequestRef.operationName = 'CreatePayoutRequest';

export function createPayoutRequest(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createPayoutRequestRef(dcInstance, inputVars));
}

export const markPayoutBroadcastedRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkPayoutBroadcasted', inputVars);
}
markPayoutBroadcastedRef.operationName = 'MarkPayoutBroadcasted';

export function markPayoutBroadcasted(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markPayoutBroadcastedRef(dcInstance, inputVars));
}

export const createSettlementRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSettlement', inputVars);
}
createSettlementRef.operationName = 'CreateSettlement';

export function createSettlement(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createSettlementRef(dcInstance, inputVars));
}

export const recordAuditEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RecordAuditEvent', inputVars);
}
recordAuditEventRef.operationName = 'RecordAuditEvent';

export function recordAuditEvent(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(recordAuditEventRef(dcInstance, inputVars));
}

export const getAvaSettleSummaryRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAvaSettleSummary');
}
getAvaSettleSummaryRef.operationName = 'GetAvaSettleSummary';

export function getAvaSettleSummary(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getAvaSettleSummaryRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const listRecentPayinsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListRecentPayins', inputVars);
}
listRecentPayinsRef.operationName = 'ListRecentPayins';

export function listRecentPayins(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listRecentPayinsRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const getPayinByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPayinById', inputVars);
}
getPayinByIdRef.operationName = 'GetPayinById';

export function getPayinById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getPayinByIdRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const listRecentPayoutsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListRecentPayouts', inputVars);
}
listRecentPayoutsRef.operationName = 'ListRecentPayouts';

export function listRecentPayouts(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listRecentPayoutsRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const getPayoutByExternalIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPayoutByExternalId', inputVars);
}
getPayoutByExternalIdRef.operationName = 'GetPayoutByExternalId';

export function getPayoutByExternalId(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getPayoutByExternalIdRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const listRecentSettlementsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListRecentSettlements', inputVars);
}
listRecentSettlementsRef.operationName = 'ListRecentSettlements';

export function listRecentSettlements(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listRecentSettlementsRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

export const listAuditEventsForSubjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAuditEventsForSubject', inputVars);
}
listAuditEventsForSubjectRef.operationName = 'ListAuditEventsForSubject';

export function listAuditEventsForSubject(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listAuditEventsForSubjectRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}

