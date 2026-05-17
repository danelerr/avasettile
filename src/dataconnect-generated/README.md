# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `institutional`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetAvaSettleSummary*](#getavasettlesummary)
  - [*ListRecentPayins*](#listrecentpayins)
  - [*GetPayinById*](#getpayinbyid)
  - [*ListRecentPayouts*](#listrecentpayouts)
  - [*GetPayoutByExternalId*](#getpayoutbyexternalid)
  - [*ListRecentSettlements*](#listrecentsettlements)
  - [*ListAuditEventsForSubject*](#listauditeventsforsubject)
- [**Mutations**](#mutations)
  - [*CreatePayinIntent*](#createpayinintent)
  - [*MarkPayinDetected*](#markpayindetected)
  - [*MarkPayinSweepSubmitted*](#markpayinsweepsubmitted)
  - [*CreatePayoutRequest*](#createpayoutrequest)
  - [*MarkPayoutBroadcasted*](#markpayoutbroadcasted)
  - [*CreateSettlement*](#createsettlement)
  - [*RecordAuditEvent*](#recordauditevent)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `institutional`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `institutional` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetAvaSettleSummary
You can execute the `GetAvaSettleSummary` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getAvaSettleSummary(options?: ExecuteQueryOptions): QueryPromise<GetAvaSettleSummaryData, undefined>;

interface GetAvaSettleSummaryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetAvaSettleSummaryData, undefined>;
}
export const getAvaSettleSummaryRef: GetAvaSettleSummaryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAvaSettleSummary(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetAvaSettleSummaryData, undefined>;

interface GetAvaSettleSummaryRef {
  ...
  (dc: DataConnect): QueryRef<GetAvaSettleSummaryData, undefined>;
}
export const getAvaSettleSummaryRef: GetAvaSettleSummaryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getAvaSettleSummaryRef:
```typescript
const name = getAvaSettleSummaryRef.operationName;
console.log(name);
```

### Variables
The `GetAvaSettleSummary` query has no variables.
### Return Type
Recall that executing the `GetAvaSettleSummary` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetAvaSettleSummaryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetAvaSettleSummary`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getAvaSettleSummary } from '@dataconnect/generated';


// Call the `getAvaSettleSummary()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getAvaSettleSummary();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getAvaSettleSummary(dataConnect);

console.log(data.avaSettleSummaries);

// Or, you can use the `Promise` API.
getAvaSettleSummary().then((response) => {
  const data = response.data;
  console.log(data.avaSettleSummaries);
});
```

### Using `GetAvaSettleSummary`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getAvaSettleSummaryRef } from '@dataconnect/generated';


// Call the `getAvaSettleSummaryRef()` function to get a reference to the query.
const ref = getAvaSettleSummaryRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getAvaSettleSummaryRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.avaSettleSummaries);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.avaSettleSummaries);
});
```

## ListRecentPayins
You can execute the `ListRecentPayins` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listRecentPayins(vars: ListRecentPayinsVariables, options?: ExecuteQueryOptions): QueryPromise<ListRecentPayinsData, ListRecentPayinsVariables>;

interface ListRecentPayinsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListRecentPayinsVariables): QueryRef<ListRecentPayinsData, ListRecentPayinsVariables>;
}
export const listRecentPayinsRef: ListRecentPayinsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listRecentPayins(dc: DataConnect, vars: ListRecentPayinsVariables, options?: ExecuteQueryOptions): QueryPromise<ListRecentPayinsData, ListRecentPayinsVariables>;

interface ListRecentPayinsRef {
  ...
  (dc: DataConnect, vars: ListRecentPayinsVariables): QueryRef<ListRecentPayinsData, ListRecentPayinsVariables>;
}
export const listRecentPayinsRef: ListRecentPayinsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listRecentPayinsRef:
```typescript
const name = listRecentPayinsRef.operationName;
console.log(name);
```

### Variables
The `ListRecentPayins` query requires an argument of type `ListRecentPayinsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListRecentPayinsVariables {
  limit: number;
}
```
### Return Type
Recall that executing the `ListRecentPayins` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListRecentPayinsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListRecentPayins`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listRecentPayins, ListRecentPayinsVariables } from '@dataconnect/generated';

// The `ListRecentPayins` query requires an argument of type `ListRecentPayinsVariables`:
const listRecentPayinsVars: ListRecentPayinsVariables = {
  limit: ..., 
};

// Call the `listRecentPayins()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listRecentPayins(listRecentPayinsVars);
// Variables can be defined inline as well.
const { data } = await listRecentPayins({ limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listRecentPayins(dataConnect, listRecentPayinsVars);

console.log(data.payinIntents);

// Or, you can use the `Promise` API.
listRecentPayins(listRecentPayinsVars).then((response) => {
  const data = response.data;
  console.log(data.payinIntents);
});
```

### Using `ListRecentPayins`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listRecentPayinsRef, ListRecentPayinsVariables } from '@dataconnect/generated';

// The `ListRecentPayins` query requires an argument of type `ListRecentPayinsVariables`:
const listRecentPayinsVars: ListRecentPayinsVariables = {
  limit: ..., 
};

// Call the `listRecentPayinsRef()` function to get a reference to the query.
const ref = listRecentPayinsRef(listRecentPayinsVars);
// Variables can be defined inline as well.
const ref = listRecentPayinsRef({ limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listRecentPayinsRef(dataConnect, listRecentPayinsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.payinIntents);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.payinIntents);
});
```

## GetPayinById
You can execute the `GetPayinById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getPayinById(vars: GetPayinByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetPayinByIdData, GetPayinByIdVariables>;

interface GetPayinByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPayinByIdVariables): QueryRef<GetPayinByIdData, GetPayinByIdVariables>;
}
export const getPayinByIdRef: GetPayinByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getPayinById(dc: DataConnect, vars: GetPayinByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetPayinByIdData, GetPayinByIdVariables>;

interface GetPayinByIdRef {
  ...
  (dc: DataConnect, vars: GetPayinByIdVariables): QueryRef<GetPayinByIdData, GetPayinByIdVariables>;
}
export const getPayinByIdRef: GetPayinByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getPayinByIdRef:
```typescript
const name = getPayinByIdRef.operationName;
console.log(name);
```

### Variables
The `GetPayinById` query requires an argument of type `GetPayinByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetPayinByIdVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetPayinById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetPayinByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetPayinById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getPayinById, GetPayinByIdVariables } from '@dataconnect/generated';

// The `GetPayinById` query requires an argument of type `GetPayinByIdVariables`:
const getPayinByIdVars: GetPayinByIdVariables = {
  id: ..., 
};

// Call the `getPayinById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getPayinById(getPayinByIdVars);
// Variables can be defined inline as well.
const { data } = await getPayinById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getPayinById(dataConnect, getPayinByIdVars);

console.log(data.payinIntent);

// Or, you can use the `Promise` API.
getPayinById(getPayinByIdVars).then((response) => {
  const data = response.data;
  console.log(data.payinIntent);
});
```

### Using `GetPayinById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getPayinByIdRef, GetPayinByIdVariables } from '@dataconnect/generated';

// The `GetPayinById` query requires an argument of type `GetPayinByIdVariables`:
const getPayinByIdVars: GetPayinByIdVariables = {
  id: ..., 
};

// Call the `getPayinByIdRef()` function to get a reference to the query.
const ref = getPayinByIdRef(getPayinByIdVars);
// Variables can be defined inline as well.
const ref = getPayinByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getPayinByIdRef(dataConnect, getPayinByIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.payinIntent);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.payinIntent);
});
```

## ListRecentPayouts
You can execute the `ListRecentPayouts` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listRecentPayouts(vars: ListRecentPayoutsVariables, options?: ExecuteQueryOptions): QueryPromise<ListRecentPayoutsData, ListRecentPayoutsVariables>;

interface ListRecentPayoutsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListRecentPayoutsVariables): QueryRef<ListRecentPayoutsData, ListRecentPayoutsVariables>;
}
export const listRecentPayoutsRef: ListRecentPayoutsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listRecentPayouts(dc: DataConnect, vars: ListRecentPayoutsVariables, options?: ExecuteQueryOptions): QueryPromise<ListRecentPayoutsData, ListRecentPayoutsVariables>;

interface ListRecentPayoutsRef {
  ...
  (dc: DataConnect, vars: ListRecentPayoutsVariables): QueryRef<ListRecentPayoutsData, ListRecentPayoutsVariables>;
}
export const listRecentPayoutsRef: ListRecentPayoutsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listRecentPayoutsRef:
```typescript
const name = listRecentPayoutsRef.operationName;
console.log(name);
```

### Variables
The `ListRecentPayouts` query requires an argument of type `ListRecentPayoutsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListRecentPayoutsVariables {
  limit: number;
}
```
### Return Type
Recall that executing the `ListRecentPayouts` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListRecentPayoutsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListRecentPayouts`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listRecentPayouts, ListRecentPayoutsVariables } from '@dataconnect/generated';

// The `ListRecentPayouts` query requires an argument of type `ListRecentPayoutsVariables`:
const listRecentPayoutsVars: ListRecentPayoutsVariables = {
  limit: ..., 
};

// Call the `listRecentPayouts()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listRecentPayouts(listRecentPayoutsVars);
// Variables can be defined inline as well.
const { data } = await listRecentPayouts({ limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listRecentPayouts(dataConnect, listRecentPayoutsVars);

console.log(data.payoutRequests);

// Or, you can use the `Promise` API.
listRecentPayouts(listRecentPayoutsVars).then((response) => {
  const data = response.data;
  console.log(data.payoutRequests);
});
```

### Using `ListRecentPayouts`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listRecentPayoutsRef, ListRecentPayoutsVariables } from '@dataconnect/generated';

// The `ListRecentPayouts` query requires an argument of type `ListRecentPayoutsVariables`:
const listRecentPayoutsVars: ListRecentPayoutsVariables = {
  limit: ..., 
};

// Call the `listRecentPayoutsRef()` function to get a reference to the query.
const ref = listRecentPayoutsRef(listRecentPayoutsVars);
// Variables can be defined inline as well.
const ref = listRecentPayoutsRef({ limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listRecentPayoutsRef(dataConnect, listRecentPayoutsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.payoutRequests);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.payoutRequests);
});
```

## GetPayoutByExternalId
You can execute the `GetPayoutByExternalId` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getPayoutByExternalId(vars: GetPayoutByExternalIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetPayoutByExternalIdData, GetPayoutByExternalIdVariables>;

interface GetPayoutByExternalIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPayoutByExternalIdVariables): QueryRef<GetPayoutByExternalIdData, GetPayoutByExternalIdVariables>;
}
export const getPayoutByExternalIdRef: GetPayoutByExternalIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getPayoutByExternalId(dc: DataConnect, vars: GetPayoutByExternalIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetPayoutByExternalIdData, GetPayoutByExternalIdVariables>;

interface GetPayoutByExternalIdRef {
  ...
  (dc: DataConnect, vars: GetPayoutByExternalIdVariables): QueryRef<GetPayoutByExternalIdData, GetPayoutByExternalIdVariables>;
}
export const getPayoutByExternalIdRef: GetPayoutByExternalIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getPayoutByExternalIdRef:
```typescript
const name = getPayoutByExternalIdRef.operationName;
console.log(name);
```

### Variables
The `GetPayoutByExternalId` query requires an argument of type `GetPayoutByExternalIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetPayoutByExternalIdVariables {
  externalId: string;
}
```
### Return Type
Recall that executing the `GetPayoutByExternalId` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetPayoutByExternalIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetPayoutByExternalId`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getPayoutByExternalId, GetPayoutByExternalIdVariables } from '@dataconnect/generated';

// The `GetPayoutByExternalId` query requires an argument of type `GetPayoutByExternalIdVariables`:
const getPayoutByExternalIdVars: GetPayoutByExternalIdVariables = {
  externalId: ..., 
};

// Call the `getPayoutByExternalId()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getPayoutByExternalId(getPayoutByExternalIdVars);
// Variables can be defined inline as well.
const { data } = await getPayoutByExternalId({ externalId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getPayoutByExternalId(dataConnect, getPayoutByExternalIdVars);

console.log(data.payoutRequests);

// Or, you can use the `Promise` API.
getPayoutByExternalId(getPayoutByExternalIdVars).then((response) => {
  const data = response.data;
  console.log(data.payoutRequests);
});
```

### Using `GetPayoutByExternalId`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getPayoutByExternalIdRef, GetPayoutByExternalIdVariables } from '@dataconnect/generated';

// The `GetPayoutByExternalId` query requires an argument of type `GetPayoutByExternalIdVariables`:
const getPayoutByExternalIdVars: GetPayoutByExternalIdVariables = {
  externalId: ..., 
};

// Call the `getPayoutByExternalIdRef()` function to get a reference to the query.
const ref = getPayoutByExternalIdRef(getPayoutByExternalIdVars);
// Variables can be defined inline as well.
const ref = getPayoutByExternalIdRef({ externalId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getPayoutByExternalIdRef(dataConnect, getPayoutByExternalIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.payoutRequests);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.payoutRequests);
});
```

## ListRecentSettlements
You can execute the `ListRecentSettlements` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listRecentSettlements(vars: ListRecentSettlementsVariables, options?: ExecuteQueryOptions): QueryPromise<ListRecentSettlementsData, ListRecentSettlementsVariables>;

interface ListRecentSettlementsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListRecentSettlementsVariables): QueryRef<ListRecentSettlementsData, ListRecentSettlementsVariables>;
}
export const listRecentSettlementsRef: ListRecentSettlementsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listRecentSettlements(dc: DataConnect, vars: ListRecentSettlementsVariables, options?: ExecuteQueryOptions): QueryPromise<ListRecentSettlementsData, ListRecentSettlementsVariables>;

interface ListRecentSettlementsRef {
  ...
  (dc: DataConnect, vars: ListRecentSettlementsVariables): QueryRef<ListRecentSettlementsData, ListRecentSettlementsVariables>;
}
export const listRecentSettlementsRef: ListRecentSettlementsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listRecentSettlementsRef:
```typescript
const name = listRecentSettlementsRef.operationName;
console.log(name);
```

### Variables
The `ListRecentSettlements` query requires an argument of type `ListRecentSettlementsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListRecentSettlementsVariables {
  limit: number;
}
```
### Return Type
Recall that executing the `ListRecentSettlements` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListRecentSettlementsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListRecentSettlements`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listRecentSettlements, ListRecentSettlementsVariables } from '@dataconnect/generated';

// The `ListRecentSettlements` query requires an argument of type `ListRecentSettlementsVariables`:
const listRecentSettlementsVars: ListRecentSettlementsVariables = {
  limit: ..., 
};

// Call the `listRecentSettlements()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listRecentSettlements(listRecentSettlementsVars);
// Variables can be defined inline as well.
const { data } = await listRecentSettlements({ limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listRecentSettlements(dataConnect, listRecentSettlementsVars);

console.log(data.settlements);

// Or, you can use the `Promise` API.
listRecentSettlements(listRecentSettlementsVars).then((response) => {
  const data = response.data;
  console.log(data.settlements);
});
```

### Using `ListRecentSettlements`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listRecentSettlementsRef, ListRecentSettlementsVariables } from '@dataconnect/generated';

// The `ListRecentSettlements` query requires an argument of type `ListRecentSettlementsVariables`:
const listRecentSettlementsVars: ListRecentSettlementsVariables = {
  limit: ..., 
};

// Call the `listRecentSettlementsRef()` function to get a reference to the query.
const ref = listRecentSettlementsRef(listRecentSettlementsVars);
// Variables can be defined inline as well.
const ref = listRecentSettlementsRef({ limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listRecentSettlementsRef(dataConnect, listRecentSettlementsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.settlements);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.settlements);
});
```

## ListAuditEventsForSubject
You can execute the `ListAuditEventsForSubject` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAuditEventsForSubject(vars: ListAuditEventsForSubjectVariables, options?: ExecuteQueryOptions): QueryPromise<ListAuditEventsForSubjectData, ListAuditEventsForSubjectVariables>;

interface ListAuditEventsForSubjectRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListAuditEventsForSubjectVariables): QueryRef<ListAuditEventsForSubjectData, ListAuditEventsForSubjectVariables>;
}
export const listAuditEventsForSubjectRef: ListAuditEventsForSubjectRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAuditEventsForSubject(dc: DataConnect, vars: ListAuditEventsForSubjectVariables, options?: ExecuteQueryOptions): QueryPromise<ListAuditEventsForSubjectData, ListAuditEventsForSubjectVariables>;

interface ListAuditEventsForSubjectRef {
  ...
  (dc: DataConnect, vars: ListAuditEventsForSubjectVariables): QueryRef<ListAuditEventsForSubjectData, ListAuditEventsForSubjectVariables>;
}
export const listAuditEventsForSubjectRef: ListAuditEventsForSubjectRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAuditEventsForSubjectRef:
```typescript
const name = listAuditEventsForSubjectRef.operationName;
console.log(name);
```

### Variables
The `ListAuditEventsForSubject` query requires an argument of type `ListAuditEventsForSubjectVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAuditEventsForSubjectVariables {
  subjectId: UUIDString;
  limit: number;
}
```
### Return Type
Recall that executing the `ListAuditEventsForSubject` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAuditEventsForSubjectData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListAuditEventsForSubject`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAuditEventsForSubject, ListAuditEventsForSubjectVariables } from '@dataconnect/generated';

// The `ListAuditEventsForSubject` query requires an argument of type `ListAuditEventsForSubjectVariables`:
const listAuditEventsForSubjectVars: ListAuditEventsForSubjectVariables = {
  subjectId: ..., 
  limit: ..., 
};

// Call the `listAuditEventsForSubject()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAuditEventsForSubject(listAuditEventsForSubjectVars);
// Variables can be defined inline as well.
const { data } = await listAuditEventsForSubject({ subjectId: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAuditEventsForSubject(dataConnect, listAuditEventsForSubjectVars);

console.log(data.auditEvents);

// Or, you can use the `Promise` API.
listAuditEventsForSubject(listAuditEventsForSubjectVars).then((response) => {
  const data = response.data;
  console.log(data.auditEvents);
});
```

### Using `ListAuditEventsForSubject`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAuditEventsForSubjectRef, ListAuditEventsForSubjectVariables } from '@dataconnect/generated';

// The `ListAuditEventsForSubject` query requires an argument of type `ListAuditEventsForSubjectVariables`:
const listAuditEventsForSubjectVars: ListAuditEventsForSubjectVariables = {
  subjectId: ..., 
  limit: ..., 
};

// Call the `listAuditEventsForSubjectRef()` function to get a reference to the query.
const ref = listAuditEventsForSubjectRef(listAuditEventsForSubjectVars);
// Variables can be defined inline as well.
const ref = listAuditEventsForSubjectRef({ subjectId: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAuditEventsForSubjectRef(dataConnect, listAuditEventsForSubjectVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.auditEvents);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.auditEvents);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `institutional` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreatePayinIntent
You can execute the `CreatePayinIntent` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createPayinIntent(vars: CreatePayinIntentVariables): MutationPromise<CreatePayinIntentData, CreatePayinIntentVariables>;

interface CreatePayinIntentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePayinIntentVariables): MutationRef<CreatePayinIntentData, CreatePayinIntentVariables>;
}
export const createPayinIntentRef: CreatePayinIntentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createPayinIntent(dc: DataConnect, vars: CreatePayinIntentVariables): MutationPromise<CreatePayinIntentData, CreatePayinIntentVariables>;

interface CreatePayinIntentRef {
  ...
  (dc: DataConnect, vars: CreatePayinIntentVariables): MutationRef<CreatePayinIntentData, CreatePayinIntentVariables>;
}
export const createPayinIntentRef: CreatePayinIntentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createPayinIntentRef:
```typescript
const name = createPayinIntentRef.operationName;
console.log(name);
```

### Variables
The `CreatePayinIntent` mutation requires an argument of type `CreatePayinIntentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `CreatePayinIntent` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreatePayinIntentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreatePayinIntentData {
  payinIntent_insert: PayinIntent_Key;
}
```
### Using `CreatePayinIntent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createPayinIntent, CreatePayinIntentVariables } from '@dataconnect/generated';

// The `CreatePayinIntent` mutation requires an argument of type `CreatePayinIntentVariables`:
const createPayinIntentVars: CreatePayinIntentVariables = {
  externalId: ..., // optional
  invoiceId: ..., // optional
  mode: ..., 
  network: ..., 
  chainId: ..., 
  asset: ..., 
  tokenAddress: ..., // optional
  decimals: ..., 
  amountExpected: ..., 
  amountExpectedAtomic: ..., 
  depositAddress: ..., // optional
  derivationAccount: ..., // optional
  derivationIndex: ..., // optional
  startBlock: ..., // optional
  expiresAt: ..., // optional
  metadata: ..., 
};

// Call the `createPayinIntent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createPayinIntent(createPayinIntentVars);
// Variables can be defined inline as well.
const { data } = await createPayinIntent({ externalId: ..., invoiceId: ..., mode: ..., network: ..., chainId: ..., asset: ..., tokenAddress: ..., decimals: ..., amountExpected: ..., amountExpectedAtomic: ..., depositAddress: ..., derivationAccount: ..., derivationIndex: ..., startBlock: ..., expiresAt: ..., metadata: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createPayinIntent(dataConnect, createPayinIntentVars);

console.log(data.payinIntent_insert);

// Or, you can use the `Promise` API.
createPayinIntent(createPayinIntentVars).then((response) => {
  const data = response.data;
  console.log(data.payinIntent_insert);
});
```

### Using `CreatePayinIntent`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createPayinIntentRef, CreatePayinIntentVariables } from '@dataconnect/generated';

// The `CreatePayinIntent` mutation requires an argument of type `CreatePayinIntentVariables`:
const createPayinIntentVars: CreatePayinIntentVariables = {
  externalId: ..., // optional
  invoiceId: ..., // optional
  mode: ..., 
  network: ..., 
  chainId: ..., 
  asset: ..., 
  tokenAddress: ..., // optional
  decimals: ..., 
  amountExpected: ..., 
  amountExpectedAtomic: ..., 
  depositAddress: ..., // optional
  derivationAccount: ..., // optional
  derivationIndex: ..., // optional
  startBlock: ..., // optional
  expiresAt: ..., // optional
  metadata: ..., 
};

// Call the `createPayinIntentRef()` function to get a reference to the mutation.
const ref = createPayinIntentRef(createPayinIntentVars);
// Variables can be defined inline as well.
const ref = createPayinIntentRef({ externalId: ..., invoiceId: ..., mode: ..., network: ..., chainId: ..., asset: ..., tokenAddress: ..., decimals: ..., amountExpected: ..., amountExpectedAtomic: ..., depositAddress: ..., derivationAccount: ..., derivationIndex: ..., startBlock: ..., expiresAt: ..., metadata: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createPayinIntentRef(dataConnect, createPayinIntentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.payinIntent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.payinIntent_insert);
});
```

## MarkPayinDetected
You can execute the `MarkPayinDetected` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
markPayinDetected(vars: MarkPayinDetectedVariables): MutationPromise<MarkPayinDetectedData, MarkPayinDetectedVariables>;

interface MarkPayinDetectedRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkPayinDetectedVariables): MutationRef<MarkPayinDetectedData, MarkPayinDetectedVariables>;
}
export const markPayinDetectedRef: MarkPayinDetectedRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
markPayinDetected(dc: DataConnect, vars: MarkPayinDetectedVariables): MutationPromise<MarkPayinDetectedData, MarkPayinDetectedVariables>;

interface MarkPayinDetectedRef {
  ...
  (dc: DataConnect, vars: MarkPayinDetectedVariables): MutationRef<MarkPayinDetectedData, MarkPayinDetectedVariables>;
}
export const markPayinDetectedRef: MarkPayinDetectedRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the markPayinDetectedRef:
```typescript
const name = markPayinDetectedRef.operationName;
console.log(name);
```

### Variables
The `MarkPayinDetected` mutation requires an argument of type `MarkPayinDetectedVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MarkPayinDetectedVariables {
  id: UUIDString;
  status: PayinStatus;
  amountDetected: number;
  amountDetectedAtomic: string;
  payerAddress?: string | null;
  paidTxHash: string;
  paidBlockNumber: Int64String;
}
```
### Return Type
Recall that executing the `MarkPayinDetected` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MarkPayinDetectedData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MarkPayinDetectedData {
  payinIntent_update?: PayinIntent_Key | null;
}
```
### Using `MarkPayinDetected`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, markPayinDetected, MarkPayinDetectedVariables } from '@dataconnect/generated';

// The `MarkPayinDetected` mutation requires an argument of type `MarkPayinDetectedVariables`:
const markPayinDetectedVars: MarkPayinDetectedVariables = {
  id: ..., 
  status: ..., 
  amountDetected: ..., 
  amountDetectedAtomic: ..., 
  payerAddress: ..., // optional
  paidTxHash: ..., 
  paidBlockNumber: ..., 
};

// Call the `markPayinDetected()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await markPayinDetected(markPayinDetectedVars);
// Variables can be defined inline as well.
const { data } = await markPayinDetected({ id: ..., status: ..., amountDetected: ..., amountDetectedAtomic: ..., payerAddress: ..., paidTxHash: ..., paidBlockNumber: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await markPayinDetected(dataConnect, markPayinDetectedVars);

console.log(data.payinIntent_update);

// Or, you can use the `Promise` API.
markPayinDetected(markPayinDetectedVars).then((response) => {
  const data = response.data;
  console.log(data.payinIntent_update);
});
```

### Using `MarkPayinDetected`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, markPayinDetectedRef, MarkPayinDetectedVariables } from '@dataconnect/generated';

// The `MarkPayinDetected` mutation requires an argument of type `MarkPayinDetectedVariables`:
const markPayinDetectedVars: MarkPayinDetectedVariables = {
  id: ..., 
  status: ..., 
  amountDetected: ..., 
  amountDetectedAtomic: ..., 
  payerAddress: ..., // optional
  paidTxHash: ..., 
  paidBlockNumber: ..., 
};

// Call the `markPayinDetectedRef()` function to get a reference to the mutation.
const ref = markPayinDetectedRef(markPayinDetectedVars);
// Variables can be defined inline as well.
const ref = markPayinDetectedRef({ id: ..., status: ..., amountDetected: ..., amountDetectedAtomic: ..., payerAddress: ..., paidTxHash: ..., paidBlockNumber: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = markPayinDetectedRef(dataConnect, markPayinDetectedVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.payinIntent_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.payinIntent_update);
});
```

## MarkPayinSweepSubmitted
You can execute the `MarkPayinSweepSubmitted` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
markPayinSweepSubmitted(vars: MarkPayinSweepSubmittedVariables): MutationPromise<MarkPayinSweepSubmittedData, MarkPayinSweepSubmittedVariables>;

interface MarkPayinSweepSubmittedRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkPayinSweepSubmittedVariables): MutationRef<MarkPayinSweepSubmittedData, MarkPayinSweepSubmittedVariables>;
}
export const markPayinSweepSubmittedRef: MarkPayinSweepSubmittedRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
markPayinSweepSubmitted(dc: DataConnect, vars: MarkPayinSweepSubmittedVariables): MutationPromise<MarkPayinSweepSubmittedData, MarkPayinSweepSubmittedVariables>;

interface MarkPayinSweepSubmittedRef {
  ...
  (dc: DataConnect, vars: MarkPayinSweepSubmittedVariables): MutationRef<MarkPayinSweepSubmittedData, MarkPayinSweepSubmittedVariables>;
}
export const markPayinSweepSubmittedRef: MarkPayinSweepSubmittedRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the markPayinSweepSubmittedRef:
```typescript
const name = markPayinSweepSubmittedRef.operationName;
console.log(name);
```

### Variables
The `MarkPayinSweepSubmitted` mutation requires an argument of type `MarkPayinSweepSubmittedVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MarkPayinSweepSubmittedVariables {
  id: UUIDString;
  sweepDestination: string;
  sweepTxHash: string;
}
```
### Return Type
Recall that executing the `MarkPayinSweepSubmitted` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MarkPayinSweepSubmittedData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MarkPayinSweepSubmittedData {
  payinIntent_update?: PayinIntent_Key | null;
}
```
### Using `MarkPayinSweepSubmitted`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, markPayinSweepSubmitted, MarkPayinSweepSubmittedVariables } from '@dataconnect/generated';

// The `MarkPayinSweepSubmitted` mutation requires an argument of type `MarkPayinSweepSubmittedVariables`:
const markPayinSweepSubmittedVars: MarkPayinSweepSubmittedVariables = {
  id: ..., 
  sweepDestination: ..., 
  sweepTxHash: ..., 
};

// Call the `markPayinSweepSubmitted()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await markPayinSweepSubmitted(markPayinSweepSubmittedVars);
// Variables can be defined inline as well.
const { data } = await markPayinSweepSubmitted({ id: ..., sweepDestination: ..., sweepTxHash: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await markPayinSweepSubmitted(dataConnect, markPayinSweepSubmittedVars);

console.log(data.payinIntent_update);

// Or, you can use the `Promise` API.
markPayinSweepSubmitted(markPayinSweepSubmittedVars).then((response) => {
  const data = response.data;
  console.log(data.payinIntent_update);
});
```

### Using `MarkPayinSweepSubmitted`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, markPayinSweepSubmittedRef, MarkPayinSweepSubmittedVariables } from '@dataconnect/generated';

// The `MarkPayinSweepSubmitted` mutation requires an argument of type `MarkPayinSweepSubmittedVariables`:
const markPayinSweepSubmittedVars: MarkPayinSweepSubmittedVariables = {
  id: ..., 
  sweepDestination: ..., 
  sweepTxHash: ..., 
};

// Call the `markPayinSweepSubmittedRef()` function to get a reference to the mutation.
const ref = markPayinSweepSubmittedRef(markPayinSweepSubmittedVars);
// Variables can be defined inline as well.
const ref = markPayinSweepSubmittedRef({ id: ..., sweepDestination: ..., sweepTxHash: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = markPayinSweepSubmittedRef(dataConnect, markPayinSweepSubmittedVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.payinIntent_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.payinIntent_update);
});
```

## CreatePayoutRequest
You can execute the `CreatePayoutRequest` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createPayoutRequest(vars: CreatePayoutRequestVariables): MutationPromise<CreatePayoutRequestData, CreatePayoutRequestVariables>;

interface CreatePayoutRequestRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePayoutRequestVariables): MutationRef<CreatePayoutRequestData, CreatePayoutRequestVariables>;
}
export const createPayoutRequestRef: CreatePayoutRequestRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createPayoutRequest(dc: DataConnect, vars: CreatePayoutRequestVariables): MutationPromise<CreatePayoutRequestData, CreatePayoutRequestVariables>;

interface CreatePayoutRequestRef {
  ...
  (dc: DataConnect, vars: CreatePayoutRequestVariables): MutationRef<CreatePayoutRequestData, CreatePayoutRequestVariables>;
}
export const createPayoutRequestRef: CreatePayoutRequestRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createPayoutRequestRef:
```typescript
const name = createPayoutRequestRef.operationName;
console.log(name);
```

### Variables
The `CreatePayoutRequest` mutation requires an argument of type `CreatePayoutRequestVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `CreatePayoutRequest` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreatePayoutRequestData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreatePayoutRequestData {
  payoutRequest_insert: PayoutRequest_Key;
}
```
### Using `CreatePayoutRequest`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createPayoutRequest, CreatePayoutRequestVariables } from '@dataconnect/generated';

// The `CreatePayoutRequest` mutation requires an argument of type `CreatePayoutRequestVariables`:
const createPayoutRequestVars: CreatePayoutRequestVariables = {
  externalId: ..., 
  chainFlowExternalTx: ..., // optional
  chainFlowRetiroPago: ..., // optional
  chainFlowTransferBlock: ..., // optional
  chainFlowPaymentProcessor: ..., // optional
  chainFlowCurrencyCode: ..., // optional
  network: ..., 
  chainId: ..., 
  asset: ..., 
  tokenAddress: ..., // optional
  decimals: ..., 
  amount: ..., 
  amountAtomic: ..., 
  beneficiaryAddress: ..., 
  beneficiaryName: ..., // optional
  treasuryAddress: ..., // optional
  preparedAt: ..., // optional
  metadata: ..., 
};

// Call the `createPayoutRequest()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createPayoutRequest(createPayoutRequestVars);
// Variables can be defined inline as well.
const { data } = await createPayoutRequest({ externalId: ..., chainFlowExternalTx: ..., chainFlowRetiroPago: ..., chainFlowTransferBlock: ..., chainFlowPaymentProcessor: ..., chainFlowCurrencyCode: ..., network: ..., chainId: ..., asset: ..., tokenAddress: ..., decimals: ..., amount: ..., amountAtomic: ..., beneficiaryAddress: ..., beneficiaryName: ..., treasuryAddress: ..., preparedAt: ..., metadata: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createPayoutRequest(dataConnect, createPayoutRequestVars);

console.log(data.payoutRequest_insert);

// Or, you can use the `Promise` API.
createPayoutRequest(createPayoutRequestVars).then((response) => {
  const data = response.data;
  console.log(data.payoutRequest_insert);
});
```

### Using `CreatePayoutRequest`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createPayoutRequestRef, CreatePayoutRequestVariables } from '@dataconnect/generated';

// The `CreatePayoutRequest` mutation requires an argument of type `CreatePayoutRequestVariables`:
const createPayoutRequestVars: CreatePayoutRequestVariables = {
  externalId: ..., 
  chainFlowExternalTx: ..., // optional
  chainFlowRetiroPago: ..., // optional
  chainFlowTransferBlock: ..., // optional
  chainFlowPaymentProcessor: ..., // optional
  chainFlowCurrencyCode: ..., // optional
  network: ..., 
  chainId: ..., 
  asset: ..., 
  tokenAddress: ..., // optional
  decimals: ..., 
  amount: ..., 
  amountAtomic: ..., 
  beneficiaryAddress: ..., 
  beneficiaryName: ..., // optional
  treasuryAddress: ..., // optional
  preparedAt: ..., // optional
  metadata: ..., 
};

// Call the `createPayoutRequestRef()` function to get a reference to the mutation.
const ref = createPayoutRequestRef(createPayoutRequestVars);
// Variables can be defined inline as well.
const ref = createPayoutRequestRef({ externalId: ..., chainFlowExternalTx: ..., chainFlowRetiroPago: ..., chainFlowTransferBlock: ..., chainFlowPaymentProcessor: ..., chainFlowCurrencyCode: ..., network: ..., chainId: ..., asset: ..., tokenAddress: ..., decimals: ..., amount: ..., amountAtomic: ..., beneficiaryAddress: ..., beneficiaryName: ..., treasuryAddress: ..., preparedAt: ..., metadata: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createPayoutRequestRef(dataConnect, createPayoutRequestVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.payoutRequest_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.payoutRequest_insert);
});
```

## MarkPayoutBroadcasted
You can execute the `MarkPayoutBroadcasted` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
markPayoutBroadcasted(vars: MarkPayoutBroadcastedVariables): MutationPromise<MarkPayoutBroadcastedData, MarkPayoutBroadcastedVariables>;

interface MarkPayoutBroadcastedRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkPayoutBroadcastedVariables): MutationRef<MarkPayoutBroadcastedData, MarkPayoutBroadcastedVariables>;
}
export const markPayoutBroadcastedRef: MarkPayoutBroadcastedRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
markPayoutBroadcasted(dc: DataConnect, vars: MarkPayoutBroadcastedVariables): MutationPromise<MarkPayoutBroadcastedData, MarkPayoutBroadcastedVariables>;

interface MarkPayoutBroadcastedRef {
  ...
  (dc: DataConnect, vars: MarkPayoutBroadcastedVariables): MutationRef<MarkPayoutBroadcastedData, MarkPayoutBroadcastedVariables>;
}
export const markPayoutBroadcastedRef: MarkPayoutBroadcastedRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the markPayoutBroadcastedRef:
```typescript
const name = markPayoutBroadcastedRef.operationName;
console.log(name);
```

### Variables
The `MarkPayoutBroadcasted` mutation requires an argument of type `MarkPayoutBroadcastedVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MarkPayoutBroadcastedVariables {
  id: UUIDString;
  transactionHash: string;
  treasuryAddress?: string | null;
  broadcastedAt?: TimestampString | null;
}
```
### Return Type
Recall that executing the `MarkPayoutBroadcasted` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MarkPayoutBroadcastedData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MarkPayoutBroadcastedData {
  payoutRequest_update?: PayoutRequest_Key | null;
}
```
### Using `MarkPayoutBroadcasted`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, markPayoutBroadcasted, MarkPayoutBroadcastedVariables } from '@dataconnect/generated';

// The `MarkPayoutBroadcasted` mutation requires an argument of type `MarkPayoutBroadcastedVariables`:
const markPayoutBroadcastedVars: MarkPayoutBroadcastedVariables = {
  id: ..., 
  transactionHash: ..., 
  treasuryAddress: ..., // optional
  broadcastedAt: ..., // optional
};

// Call the `markPayoutBroadcasted()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await markPayoutBroadcasted(markPayoutBroadcastedVars);
// Variables can be defined inline as well.
const { data } = await markPayoutBroadcasted({ id: ..., transactionHash: ..., treasuryAddress: ..., broadcastedAt: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await markPayoutBroadcasted(dataConnect, markPayoutBroadcastedVars);

console.log(data.payoutRequest_update);

// Or, you can use the `Promise` API.
markPayoutBroadcasted(markPayoutBroadcastedVars).then((response) => {
  const data = response.data;
  console.log(data.payoutRequest_update);
});
```

### Using `MarkPayoutBroadcasted`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, markPayoutBroadcastedRef, MarkPayoutBroadcastedVariables } from '@dataconnect/generated';

// The `MarkPayoutBroadcasted` mutation requires an argument of type `MarkPayoutBroadcastedVariables`:
const markPayoutBroadcastedVars: MarkPayoutBroadcastedVariables = {
  id: ..., 
  transactionHash: ..., 
  treasuryAddress: ..., // optional
  broadcastedAt: ..., // optional
};

// Call the `markPayoutBroadcastedRef()` function to get a reference to the mutation.
const ref = markPayoutBroadcastedRef(markPayoutBroadcastedVars);
// Variables can be defined inline as well.
const ref = markPayoutBroadcastedRef({ id: ..., transactionHash: ..., treasuryAddress: ..., broadcastedAt: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = markPayoutBroadcastedRef(dataConnect, markPayoutBroadcastedVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.payoutRequest_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.payoutRequest_update);
});
```

## CreateSettlement
You can execute the `CreateSettlement` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createSettlement(vars: CreateSettlementVariables): MutationPromise<CreateSettlementData, CreateSettlementVariables>;

interface CreateSettlementRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSettlementVariables): MutationRef<CreateSettlementData, CreateSettlementVariables>;
}
export const createSettlementRef: CreateSettlementRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createSettlement(dc: DataConnect, vars: CreateSettlementVariables): MutationPromise<CreateSettlementData, CreateSettlementVariables>;

interface CreateSettlementRef {
  ...
  (dc: DataConnect, vars: CreateSettlementVariables): MutationRef<CreateSettlementData, CreateSettlementVariables>;
}
export const createSettlementRef: CreateSettlementRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createSettlementRef:
```typescript
const name = createSettlementRef.operationName;
console.log(name);
```

### Variables
The `CreateSettlement` mutation requires an argument of type `CreateSettlementVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `CreateSettlement` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateSettlementData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateSettlementData {
  settlement_insert: Settlement_Key;
}
```
### Using `CreateSettlement`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSettlement, CreateSettlementVariables } from '@dataconnect/generated';

// The `CreateSettlement` mutation requires an argument of type `CreateSettlementVariables`:
const createSettlementVars: CreateSettlementVariables = {
  sourceType: ..., 
  sourceId: ..., // optional
  asset: ..., 
  grossAmount: ..., 
  feeBps: ..., 
  feeAmount: ..., 
  netAmount: ..., 
  fiatCurrency: ..., 
  fxRate: ..., 
  fiatAmount: ..., 
  payoutRequestId: ..., // optional
  payinIntentId: ..., // optional
  metadata: ..., 
};

// Call the `createSettlement()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createSettlement(createSettlementVars);
// Variables can be defined inline as well.
const { data } = await createSettlement({ sourceType: ..., sourceId: ..., asset: ..., grossAmount: ..., feeBps: ..., feeAmount: ..., netAmount: ..., fiatCurrency: ..., fxRate: ..., fiatAmount: ..., payoutRequestId: ..., payinIntentId: ..., metadata: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createSettlement(dataConnect, createSettlementVars);

console.log(data.settlement_insert);

// Or, you can use the `Promise` API.
createSettlement(createSettlementVars).then((response) => {
  const data = response.data;
  console.log(data.settlement_insert);
});
```

### Using `CreateSettlement`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createSettlementRef, CreateSettlementVariables } from '@dataconnect/generated';

// The `CreateSettlement` mutation requires an argument of type `CreateSettlementVariables`:
const createSettlementVars: CreateSettlementVariables = {
  sourceType: ..., 
  sourceId: ..., // optional
  asset: ..., 
  grossAmount: ..., 
  feeBps: ..., 
  feeAmount: ..., 
  netAmount: ..., 
  fiatCurrency: ..., 
  fxRate: ..., 
  fiatAmount: ..., 
  payoutRequestId: ..., // optional
  payinIntentId: ..., // optional
  metadata: ..., 
};

// Call the `createSettlementRef()` function to get a reference to the mutation.
const ref = createSettlementRef(createSettlementVars);
// Variables can be defined inline as well.
const ref = createSettlementRef({ sourceType: ..., sourceId: ..., asset: ..., grossAmount: ..., feeBps: ..., feeAmount: ..., netAmount: ..., fiatCurrency: ..., fxRate: ..., fiatAmount: ..., payoutRequestId: ..., payinIntentId: ..., metadata: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createSettlementRef(dataConnect, createSettlementVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.settlement_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.settlement_insert);
});
```

## RecordAuditEvent
You can execute the `RecordAuditEvent` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
recordAuditEvent(vars: RecordAuditEventVariables): MutationPromise<RecordAuditEventData, RecordAuditEventVariables>;

interface RecordAuditEventRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RecordAuditEventVariables): MutationRef<RecordAuditEventData, RecordAuditEventVariables>;
}
export const recordAuditEventRef: RecordAuditEventRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
recordAuditEvent(dc: DataConnect, vars: RecordAuditEventVariables): MutationPromise<RecordAuditEventData, RecordAuditEventVariables>;

interface RecordAuditEventRef {
  ...
  (dc: DataConnect, vars: RecordAuditEventVariables): MutationRef<RecordAuditEventData, RecordAuditEventVariables>;
}
export const recordAuditEventRef: RecordAuditEventRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the recordAuditEventRef:
```typescript
const name = recordAuditEventRef.operationName;
console.log(name);
```

### Variables
The `RecordAuditEvent` mutation requires an argument of type `RecordAuditEventVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `RecordAuditEvent` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RecordAuditEventData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RecordAuditEventData {
  auditEvent_insert: AuditEvent_Key;
}
```
### Using `RecordAuditEvent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, recordAuditEvent, RecordAuditEventVariables } from '@dataconnect/generated';

// The `RecordAuditEvent` mutation requires an argument of type `RecordAuditEventVariables`:
const recordAuditEventVars: RecordAuditEventVariables = {
  actorType: ..., 
  actorId: ..., // optional
  subjectType: ..., 
  subjectId: ..., // optional
  eventType: ..., 
  payload: ..., 
  correlationId: ..., // optional
  requestId: ..., // optional
  ipAddress: ..., // optional
};

// Call the `recordAuditEvent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await recordAuditEvent(recordAuditEventVars);
// Variables can be defined inline as well.
const { data } = await recordAuditEvent({ actorType: ..., actorId: ..., subjectType: ..., subjectId: ..., eventType: ..., payload: ..., correlationId: ..., requestId: ..., ipAddress: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await recordAuditEvent(dataConnect, recordAuditEventVars);

console.log(data.auditEvent_insert);

// Or, you can use the `Promise` API.
recordAuditEvent(recordAuditEventVars).then((response) => {
  const data = response.data;
  console.log(data.auditEvent_insert);
});
```

### Using `RecordAuditEvent`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, recordAuditEventRef, RecordAuditEventVariables } from '@dataconnect/generated';

// The `RecordAuditEvent` mutation requires an argument of type `RecordAuditEventVariables`:
const recordAuditEventVars: RecordAuditEventVariables = {
  actorType: ..., 
  actorId: ..., // optional
  subjectType: ..., 
  subjectId: ..., // optional
  eventType: ..., 
  payload: ..., 
  correlationId: ..., // optional
  requestId: ..., // optional
  ipAddress: ..., // optional
};

// Call the `recordAuditEventRef()` function to get a reference to the mutation.
const ref = recordAuditEventRef(recordAuditEventVars);
// Variables can be defined inline as well.
const ref = recordAuditEventRef({ actorType: ..., actorId: ..., subjectType: ..., subjectId: ..., eventType: ..., payload: ..., correlationId: ..., requestId: ..., ipAddress: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = recordAuditEventRef(dataConnect, recordAuditEventVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.auditEvent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.auditEvent_insert);
});
```

