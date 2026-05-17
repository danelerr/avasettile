# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createPayinIntent, markPayinDetected, markPayinSweepSubmitted, createPayoutRequest, markPayoutBroadcasted, createSettlement, recordAuditEvent, getAvaSettleSummary, listRecentPayins, getPayinById } from '@dataconnect/generated';


// Operation CreatePayinIntent:  For variables, look at type CreatePayinIntentVars in ../index.d.ts
const { data } = await CreatePayinIntent(dataConnect, createPayinIntentVars);

// Operation MarkPayinDetected:  For variables, look at type MarkPayinDetectedVars in ../index.d.ts
const { data } = await MarkPayinDetected(dataConnect, markPayinDetectedVars);

// Operation MarkPayinSweepSubmitted:  For variables, look at type MarkPayinSweepSubmittedVars in ../index.d.ts
const { data } = await MarkPayinSweepSubmitted(dataConnect, markPayinSweepSubmittedVars);

// Operation CreatePayoutRequest:  For variables, look at type CreatePayoutRequestVars in ../index.d.ts
const { data } = await CreatePayoutRequest(dataConnect, createPayoutRequestVars);

// Operation MarkPayoutBroadcasted:  For variables, look at type MarkPayoutBroadcastedVars in ../index.d.ts
const { data } = await MarkPayoutBroadcasted(dataConnect, markPayoutBroadcastedVars);

// Operation CreateSettlement:  For variables, look at type CreateSettlementVars in ../index.d.ts
const { data } = await CreateSettlement(dataConnect, createSettlementVars);

// Operation RecordAuditEvent:  For variables, look at type RecordAuditEventVars in ../index.d.ts
const { data } = await RecordAuditEvent(dataConnect, recordAuditEventVars);

// Operation GetAvaSettleSummary: 
const { data } = await GetAvaSettleSummary(dataConnect);

// Operation ListRecentPayins:  For variables, look at type ListRecentPayinsVars in ../index.d.ts
const { data } = await ListRecentPayins(dataConnect, listRecentPayinsVars);

// Operation GetPayinById:  For variables, look at type GetPayinByIdVars in ../index.d.ts
const { data } = await GetPayinById(dataConnect, getPayinByIdVars);


```