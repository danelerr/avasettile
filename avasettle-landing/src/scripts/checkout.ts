// Hosted checkout client: loads a PaymentRouter invoice from the AvaSettle API,
// drives the payer's wallet through approve() + payInvoice(), then polls the
// API for live settlement status. Pure EIP-1193 + viem — no wallet SDK bloat.
import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  getAddress,
  parseSignature,
  type Address,
  type Hex,
} from 'viem';
import { avalanche, avalancheFuji } from 'viem/chains';

const API_BASE = (
  import.meta.env.PUBLIC_AVASETTLE_API_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');

const routerAbi = [
  {
    type: 'function',
    name: 'payInvoice',
    stateMutability: 'nonpayable',
    // The contract derives invoiceId = keccak256(invoiceRef, token, amount).
    // session.invoiceId carries the invoiceRef salt (keccak256 of the external id).
    inputs: [
      { name: 'invoiceRef', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'metadata', type: 'bytes' },
    ],
    outputs: [{ name: 'invoiceId', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'payInvoiceWithPermit',
    stateMutability: 'nonpayable',
    // One-transaction pay: the EIP-2612 permit replaces a separate approve.
    inputs: [
      { name: 'invoiceRef', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'metadata', type: 'bytes' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [{ name: 'invoiceId', type: 'bytes32' }],
  },
] as const;

// EIP-5267: canonical EIP-712 domain. Reading it avoids guessing the token's
// permit `version`, which differs across stablecoins (USDC uses "2").
const eip5267Abi = [
  {
    type: 'function',
    name: 'eip712Domain',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'fields', type: 'bytes1' },
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
      { name: 'salt', type: 'bytes32' },
      { name: 'extensions', type: 'uint256[]' },
    ],
  },
] as const;

const noncesAbi = [
  {
    type: 'function',
    name: 'nonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

type CheckoutConfig = {
  network: 'avalanche-fuji' | 'avalanche-mainnet';
  chainId: number;
  networkName: string;
  explorerBaseUrl: string;
  demoEnabled: boolean;
  router: { address: Address | null; configured: boolean };
  token: { symbol: string; address: Address | null; decimals: number };
};

type SessionView = {
  id: string;
  status:
    | 'pending'
    | 'detected'
    | 'confirmed'
    | 'expired'
    | 'underpaid'
    | 'overpaid';
  asset: string;
  amount: string;
  amountAtomic: string;
  receivedAmount: string;
  chainId: number;
  tokenAddress: Address;
  routerAddress: Address | null;
  invoiceId: Hex | null;
  reference: string | null;
  explorerBaseUrl: string;
  transactions: { hash: Hex; amount: string; blockNumber: string }[];
  createdAt: string;
  confirmedAt: string | null;
  detectedAt: string | null;
};

type Ethereum = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const VIEM_CHAINS = { 43114: avalanche, 43113: avalancheFuji } as const;

const ADD_CHAIN_PARAMS: Record<number, Record<string, unknown>> = {
  43113: {
    chainId: '0xa869',
    chainName: 'Avalanche Fuji C-Chain',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
    blockExplorerUrls: ['https://testnet.snowtrace.io'],
  },
  43114: {
    chainId: '0xa86a',
    chainName: 'Avalanche C-Chain',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
    blockExplorerUrls: ['https://snowtrace.io'],
  },
};

// ── DOM helpers ────────────────────────────────────────────────────────────

const $ = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

function show(id: string, visible: boolean): void {
  const el = $(id);
  if (el) el.hidden = !visible;
}

function setText(id: string, text: string): void {
  const el = $(id);
  if (el) el.textContent = text;
}

function truncateMiddle(value: string, lead = 10, tail = 8): string {
  return value.length <= lead + tail + 1
    ? value
    : `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

function note(message: string, kind: 'info' | 'error' = 'info'): void {
  const el = $('action-note');
  if (!el) return;
  el.textContent = message;
  el.dataset.kind = kind;
}

// ── API ──────────────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${await safeBody(res)}`);
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${await safeBody(res)}`);
  return res.json() as Promise<T>;
}

async function safeBody(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: unknown };
    return Array.isArray(data.message)
      ? data.message.join(', ')
      : String(data.message ?? res.statusText);
  } catch {
    return res.statusText;
  }
}

// ── Status rendering ──────────────────────────────────────────────────────────

const STEP_ORDER = ['created', 'paid', 'detected', 'confirmed'] as const;
type Step = (typeof STEP_ORDER)[number];

function renderStatus(session: SessionView, paidLocally: boolean): void {
  let reached: Step = 'created';
  if (session.status === 'confirmed') reached = 'confirmed';
  else if (session.status === 'detected' || session.transactions.length > 0)
    reached = 'detected';
  else if (paidLocally) reached = 'paid';

  const reachedIdx = STEP_ORDER.indexOf(reached);
  for (const step of STEP_ORDER) {
    const el = document.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (el) el.dataset.state = STEP_ORDER.indexOf(step) <= reachedIdx ? 'on' : 'off';
  }

  const pill = $('status-pill');
  if (pill) {
    const label: Record<string, string> = {
      pending: paidLocally ? 'Pago enviado' : 'Esperando pago',
      detected: 'Detectado on-chain',
      confirmed: 'Confirmado',
      expired: 'Expirado',
      underpaid: 'Monto insuficiente',
      overpaid: 'Monto excedido',
    };
    pill.textContent = label[session.status] ?? session.status;
    pill.dataset.status = session.status;
  }

  if (session.transactions.length > 0) {
    const link = $<HTMLAnchorElement>('tx-link');
    if (link) {
      link.href = `${session.explorerBaseUrl}/tx/${session.transactions[0].hash}`;
      link.textContent = truncateMiddle(session.transactions[0].hash, 12, 10);
      show('tx-row', true);
    }
  }
}

// ── Wallet flow ───────────────────────────────────────────────────────────────

let config: CheckoutConfig;
let session: SessionView;
let paidLocally = false;
let polling = false;

function getEthereum(): Ethereum | null {
  return (window as unknown as { ethereum?: Ethereum }).ethereum ?? null;
}

async function ensureChain(eth: Ethereum, chainId: number): Promise<void> {
  const current = (await eth.request({ method: 'eth_chainId' })) as string;
  if (parseInt(current, 16) === chainId) return;
  const hexId = `0x${chainId.toString(16)}`;
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexId }],
    });
  } catch (error) {
    // 4902 = chain not added to the wallet yet.
    if ((error as { code?: number }).code === 4902 && ADD_CHAIN_PARAMS[chainId]) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [ADD_CHAIN_PARAMS[chainId]],
      });
    } else {
      throw error;
    }
  }
}

type WalletClient = ReturnType<typeof createWalletClient>;
type ReadClient = ReturnType<typeof createPublicClient>;

/**
 * Best-effort EIP-2612 permit so the payer signs once and pays in a single
 * transaction (no separate approve). Reads the token's canonical EIP-712 domain
 * (EIP-5267) to avoid guessing the permit `version`. Returns null if anything
 * is unavailable — the caller then falls back to approve + payInvoice, so this
 * never blocks a payment.
 */
async function tryPermitSignature(
  readClient: ReadClient,
  walletClient: WalletClient,
  account: Address,
  token: Address,
  spender: Address,
  amount: bigint,
): Promise<{ deadline: bigint; v: number; r: Hex; s: Hex } | null> {
  try {
    const [, name, version, , verifyingContract] = await readClient.readContract({
      address: token,
      abi: eip5267Abi,
      functionName: 'eip712Domain',
    });
    const nonce = await readClient.readContract({
      address: token,
      abi: noncesAbi,
      functionName: 'nonces',
      args: [account],
    });
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const signature = await walletClient.signTypedData({
      account,
      domain: { name, version, chainId: config.chainId, verifyingContract },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: { owner: account, spender, value: amount, nonce, deadline },
    });
    const { r, s, v } = parseSignature(signature);
    if (v === undefined) return null;
    return { deadline, v: Number(v), r, s };
  } catch {
    return null;
  }
}

async function pay(): Promise<void> {
  const eth = getEthereum();
  if (!eth) {
    note(
      'No detectamos una wallet. Instala MetaMask o Core para pagar.',
      'error',
    );
    return;
  }
  if (!session.routerAddress || !session.invoiceId) {
    note('Esta invoice no está lista para cobrarse.', 'error');
    return;
  }

  const button = $<HTMLButtonElement>('action-btn');
  if (button) button.disabled = true;

  try {
    const chain = VIEM_CHAINS[config.chainId as keyof typeof VIEM_CHAINS];
    note('Conectando wallet…');
    await ensureChain(eth, config.chainId);

    const walletClient = createWalletClient({ chain, transport: custom(eth) });
    const publicClient = createPublicClient({ chain, transport: custom(eth) });
    const [account] = await walletClient.requestAddresses();

    const router = getAddress(session.routerAddress);
    const token = getAddress(session.tokenAddress);
    const amount = BigInt(session.amountAtomic);

    const invoiceRef = session.invoiceId;

    // Prefer a single-transaction pay via EIP-2612 permit; fall back to the
    // classic approve + payInvoice when the token doesn't support permit.
    note('Prepara el pago en tu wallet…');
    const permit = await tryPermitSignature(
      publicClient,
      walletClient,
      account,
      token,
      router,
      amount,
    );

    let payHash: Hex;
    if (permit) {
      note(`Confirma el pago de ${session.amount} ${session.asset} en tu wallet…`);
      payHash = await walletClient.writeContract({
        account,
        chain,
        address: router,
        abi: routerAbi,
        functionName: 'payInvoiceWithPermit',
        args: [
          invoiceRef,
          token,
          amount,
          '0x',
          permit.deadline,
          permit.v,
          permit.r,
          permit.s,
        ],
      });
    } else {
      const allowance = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account, router],
      });
      if (allowance < amount) {
        note(`Aprueba ${session.amount} ${session.asset} en tu wallet…`);
        const approveHash = await walletClient.writeContract({
          account,
          chain,
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [router, amount],
        });
        note('Esperando la aprobación on-chain…');
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      note(`Confirma el pago de ${session.amount} ${session.asset} en tu wallet…`);
      payHash = await walletClient.writeContract({
        account,
        chain,
        address: router,
        abi: routerAbi,
        functionName: 'payInvoice',
        args: [invoiceRef, token, amount, '0x'],
      });
    }

    paidLocally = true;
    renderStatus(session, paidLocally);
    note('Pago enviado. Esperando confirmación on-chain…');
    await publicClient.waitForTransactionReceipt({ hash: payHash });

    if (button) {
      button.hidden = true;
    }
    void poll();
  } catch (error) {
    const message =
      (error as { shortMessage?: string }).shortMessage ??
      (error as Error).message ??
      'No se pudo completar el pago.';
    note(message, 'error');
    if (button) button.disabled = false;
  }
}

// Reconcile on a cadence until the invoice confirms (or a safety cap is hit).
async function poll(): Promise<void> {
  if (polling) return;
  polling = true;
  for (let i = 0; i < 60; i++) {
    try {
      session = await apiPost<SessionView>(
        `/checkout/sessions/${session.id}/reconcile`,
      );
      renderStatus(session, paidLocally);
      if (session.status === 'confirmed') {
        note('Pago confirmado y conciliado por AvaSettle. ✓');
        return;
      }
      if (session.status === 'detected') {
        note('Pago detectado on-chain. Esperando confirmaciones…');
      }
    } catch {
      // transient — keep polling
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  polling = false;
}

// ── Create-invoice form (when no session id is in the URL) ───────────────────

function wireCreateForm(): void {
  const form = $<HTMLFormElement>('create-form');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    void (async () => {
      const submit = $<HTMLButtonElement>('create-submit');
      const amount = $<HTMLInputElement>('amount-input')?.value.trim() ?? '';
      const reference =
        $<HTMLInputElement>('reference-input')?.value.trim() || undefined;
      if (submit) submit.disabled = true;
      setText('create-error', '');
      try {
        const created = await apiPost<SessionView>('/checkout/sessions', {
          amount,
          reference,
        });
        window.location.search = `?session=${created.id}`;
      } catch (error) {
        setText('create-error', (error as Error).message);
        if (submit) submit.disabled = false;
      }
    })();
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

function renderInvoice(): void {
  setText('amount-display', `${session.amount} ${session.asset}`);
  setText('net-badge', config.networkName);
  if (session.reference) {
    setText('reference-display', session.reference);
    show('reference-row', true);
  }
  if (session.invoiceId) {
    setText('invoice-id', truncateMiddle(session.invoiceId, 12, 10));
  }
  renderStatus(session, paidLocally);

  const button = $<HTMLButtonElement>('action-btn');
  if (session.status === 'confirmed') {
    if (button) button.hidden = true;
    note('Pago confirmado y conciliado por AvaSettle. ✓');
  } else {
    if (button) {
      button.textContent = `Pagar ${session.amount} ${session.asset}`;
      button.addEventListener('click', () => void pay());
    }
    if (session.transactions.length > 0) void poll();
  }
}

async function boot(): Promise<void> {
  try {
    config = await apiGet<CheckoutConfig>('/checkout/config');
  } catch {
    show('unavailable', true);
    setText(
      'unavailable-text',
      'No pudimos conectar con AvaSettle. Intenta de nuevo en un momento.',
    );
    return;
  }

  if (!config.router.configured) {
    show('unavailable', true);
    setText(
      'unavailable-text',
      'El checkout aún no está disponible: el contrato de cobros no está desplegado en esta red.',
    );
    return;
  }

  const sessionId = new URLSearchParams(window.location.search).get('session');

  if (!sessionId) {
    if (!config.demoEnabled) {
      show('unavailable', true);
      setText('unavailable-text', 'El checkout de demostración está deshabilitado.');
      return;
    }
    setText('create-asset', config.token.symbol);
    show('create-panel', true);
    wireCreateForm();
    return;
  }

  try {
    session = await apiGet<SessionView>(`/checkout/sessions/${sessionId}`);
  } catch {
    show('unavailable', true);
    setText('unavailable-text', 'No encontramos esta invoice.');
    return;
  }

  show('pay-panel', true);
  renderInvoice();
}

void boot();
