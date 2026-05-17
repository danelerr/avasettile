const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs, makeMemoryCacheProvider } = require('firebase/data-connect');

const PayinMode = {
  deposit_address: "deposit_address",
  payment_router: "payment_router",
  eerc_private: "eerc_private",
}
exports.PayinMode = PayinMode;

const PayinStatus = {
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
exports.PayinStatus = PayinStatus;

const PayoutStatus = {
  prepared: "prepared",
  authorized: "authorized",
  broadcasted: "broadcasted",
  confirmed: "confirmed",
  failed: "failed",
  canceled: "canceled",
  needs_review: "needs_review",
}
exports.PayoutStatus = PayoutStatus;

const SettlementSourceType = {
  payin: "payin",
  payout: "payout",
  manual: "manual",
  router_payin: "router_payin",
  eerc_private_payment: "eerc_private_payment",
}
exports.SettlementSourceType = SettlementSourceType;

const SettlementStatus = {
  pending: "pending",
  completed: "completed",
  failed: "failed",
  canceled: "canceled",
}
exports.SettlementStatus = SettlementStatus;

const connectorConfig = {
  connector: 'institutional',
  service: 'test-bd-9817c-service',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;
const dataConnectSettings = {
  cacheSettings: {
    cacheProvider: makeMemoryCacheProvider()
  }
};
exports.dataConnectSettings = dataConnectSettings;

const createPayinIntentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePayinIntent', inputVars);
}
createPayinIntentRef.operationName = 'CreatePayinIntent';
exports.createPayinIntentRef = createPayinIntentRef;

exports.createPayinIntent = function createPayinIntent(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createPayinIntentRef(dcInstance, inputVars));
}
;

const markPayinDetectedRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkPayinDetected', inputVars);
}
markPayinDetectedRef.operationName = 'MarkPayinDetected';
exports.markPayinDetectedRef = markPayinDetectedRef;

exports.markPayinDetected = function markPayinDetected(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markPayinDetectedRef(dcInstance, inputVars));
}
;

const markPayinSweepSubmittedRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkPayinSweepSubmitted', inputVars);
}
markPayinSweepSubmittedRef.operationName = 'MarkPayinSweepSubmitted';
exports.markPayinSweepSubmittedRef = markPayinSweepSubmittedRef;

exports.markPayinSweepSubmitted = function markPayinSweepSubmitted(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markPayinSweepSubmittedRef(dcInstance, inputVars));
}
;

const createPayoutRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePayoutRequest', inputVars);
}
createPayoutRequestRef.operationName = 'CreatePayoutRequest';
exports.createPayoutRequestRef = createPayoutRequestRef;

exports.createPayoutRequest = function createPayoutRequest(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createPayoutRequestRef(dcInstance, inputVars));
}
;

const markPayoutBroadcastedRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkPayoutBroadcasted', inputVars);
}
markPayoutBroadcastedRef.operationName = 'MarkPayoutBroadcasted';
exports.markPayoutBroadcastedRef = markPayoutBroadcastedRef;

exports.markPayoutBroadcasted = function markPayoutBroadcasted(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markPayoutBroadcastedRef(dcInstance, inputVars));
}
;

const createSettlementRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSettlement', inputVars);
}
createSettlementRef.operationName = 'CreateSettlement';
exports.createSettlementRef = createSettlementRef;

exports.createSettlement = function createSettlement(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createSettlementRef(dcInstance, inputVars));
}
;

const recordAuditEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RecordAuditEvent', inputVars);
}
recordAuditEventRef.operationName = 'RecordAuditEvent';
exports.recordAuditEventRef = recordAuditEventRef;

exports.recordAuditEvent = function recordAuditEvent(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(recordAuditEventRef(dcInstance, inputVars));
}
;

const getAvaSettleSummaryRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAvaSettleSummary');
}
getAvaSettleSummaryRef.operationName = 'GetAvaSettleSummary';
exports.getAvaSettleSummaryRef = getAvaSettleSummaryRef;

exports.getAvaSettleSummary = function getAvaSettleSummary(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getAvaSettleSummaryRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const listRecentPayinsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListRecentPayins', inputVars);
}
listRecentPayinsRef.operationName = 'ListRecentPayins';
exports.listRecentPayinsRef = listRecentPayinsRef;

exports.listRecentPayins = function listRecentPayins(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listRecentPayinsRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const getPayinByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPayinById', inputVars);
}
getPayinByIdRef.operationName = 'GetPayinById';
exports.getPayinByIdRef = getPayinByIdRef;

exports.getPayinById = function getPayinById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getPayinByIdRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const listRecentPayoutsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListRecentPayouts', inputVars);
}
listRecentPayoutsRef.operationName = 'ListRecentPayouts';
exports.listRecentPayoutsRef = listRecentPayoutsRef;

exports.listRecentPayouts = function listRecentPayouts(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listRecentPayoutsRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const getPayoutByExternalIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPayoutByExternalId', inputVars);
}
getPayoutByExternalIdRef.operationName = 'GetPayoutByExternalId';
exports.getPayoutByExternalIdRef = getPayoutByExternalIdRef;

exports.getPayoutByExternalId = function getPayoutByExternalId(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getPayoutByExternalIdRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const listRecentSettlementsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListRecentSettlements', inputVars);
}
listRecentSettlementsRef.operationName = 'ListRecentSettlements';
exports.listRecentSettlementsRef = listRecentSettlementsRef;

exports.listRecentSettlements = function listRecentSettlements(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listRecentSettlementsRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const listAuditEventsForSubjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAuditEventsForSubject', inputVars);
}
listAuditEventsForSubjectRef.operationName = 'ListAuditEventsForSubject';
exports.listAuditEventsForSubjectRef = listAuditEventsForSubjectRef;

exports.listAuditEventsForSubject = function listAuditEventsForSubject(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listAuditEventsForSubjectRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;
