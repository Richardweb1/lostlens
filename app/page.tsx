'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const contractAddress = '0x21833f0366e47AE826621A563346b9B107061155';
const bradburyChainId = '0x107d';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
};

type TestForm = {
  publicDescription: string;
  hiddenDetail: string;
  location: string;
  itemId: string;
  claimProof: string;
};

type LocalTx = {
  hash: string;
  label: string;
  kind: 'create_item' | 'submit_claim';
  createdAt: string;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const bradburyChain = {
  chainId: bradburyChainId,
  chainName: 'GenLayer Bradbury Testnet',
  nativeCurrency: {
    name: 'GEN',
    symbol: 'GEN',
    decimals: 18,
  },
  rpcUrls: ['https://rpc-bradbury.genlayer.com'],
  blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
};

const emptyForm: TestForm = {
  publicDescription: '',
  hiddenDetail: '',
  location: '',
  itemId: '0',
  claimProof: '',
};

const steps = [
  'Connect wallet',
  'Switch to Bradbury',
  'Create found item',
  'Submit claim',
  'Open hashes',
];

export default function Home() {
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState('');
  const [message, setMessage] = useState('Connect your wallet, then create or claim a LostLens item.');
  const [isBusy, setIsBusy] = useState(false);
  const [nextItemId, setNextItemId] = useState<number | null>(null);
  const [form, setForm] = useState<TestForm>(emptyForm);
  const [txs, setTxs] = useState<LocalTx[]>([]);

  const isBradbury = chainId.toLowerCase() === bradburyChainId;
  const shortAccount = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected';
  const createTxCount = txs.filter((tx) => tx.kind === 'create_item').length;
  const claimTxCount = txs.filter((tx) => tx.kind === 'submit_claim').length;
  const currentStep = !account ? 0 : !isBradbury ? 1 : createTxCount === 0 ? 2 : claimTxCount === 0 ? 3 : 4;

  const formSummary = useMemo(() => {
    const filled = Object.values(form).filter(Boolean).length;
    return `${filled}/5 fields filled`;
  }, [form]);

  useEffect(() => {
    const saved = window.localStorage.getItem('lostlens-local-txs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as LocalTx[];
        setTxs(parsed.filter((tx) => tx.hash?.startsWith('0x')));
      } catch {
        setTxs([]);
      }
    }

    if (!window.ethereum) return;

    window.ethereum
      .request({ method: 'eth_chainId' })
      .then((id) => setChainId(String(id)))
      .catch(() => undefined);

    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        const list = accounts as string[];
        if (list[0]) setAccount(list[0]);
      })
      .catch(() => undefined);

    const handleAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAccount(accounts?.[0] ?? '');
    };
    const handleChain = (...args: unknown[]) => setChainId(String(args[0] ?? ''));

    window.ethereum.on?.('accountsChanged', handleAccounts);
    window.ethereum.on?.('chainChanged', handleChain);

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccounts);
      window.ethereum?.removeListener?.('chainChanged', handleChain);
    };
  }, []);

  function saveTx(hash: string, kind: LocalTx['kind'], label: string) {
    const next = [
      {
        hash,
        kind,
        label,
        createdAt: new Date().toLocaleString(),
      },
      ...txs,
    ].slice(0, 8);

    setTxs(next);
    window.localStorage.setItem('lostlens-local-txs', JSON.stringify(next));
  }

  function getWriteClient() {
    if (!window.ethereum || !account) {
      throw new Error('Connect your wallet first.');
    }

    return createClient({
      chain: testnetBradbury,
      account: account as `0x${string}`,
      provider: window.ethereum as never,
    });
  }

  async function readNextItemId() {
    const client = createClient({ chain: testnetBradbury });
    const count = await client.readContract({
      address: contractAddress,
      functionName: 'get_item_count',
      args: [],
    });
    return Number(count);
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setMessage('No wallet detected. Install MetaMask or another EIP-1193 wallet.');
      return;
    }

    setIsBusy(true);
    try {
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      setAccount(accounts[0] ?? '');
      const activeChain = await window.ethereum.request({ method: 'eth_chainId' });
      setChainId(String(activeChain));
      setMessage(
        String(activeChain).toLowerCase() === bradburyChainId
          ? 'Wallet ready. Now create a found item or submit a claim.'
          : 'Wallet connected. Add Bradbury before sending a LostLens transaction.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Wallet connection was rejected.');
    } finally {
      setIsBusy(false);
    }
  }

  async function switchToBradbury() {
    if (!window.ethereum) {
      setMessage('No wallet detected. Install MetaMask or another EIP-1193 wallet.');
      return;
    }

    setIsBusy(true);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: bradburyChain.chainId }],
      });
      setChainId(bradburyChain.chainId);
      setMessage('Bradbury is active. Use Create item first, then Submit claim.');
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: number }).code : null;
      if (code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [bradburyChain],
        });
        setChainId(bradburyChain.chainId);
        setMessage('Bradbury was added. Use Create item first, then Submit claim.');
      } else {
        setMessage(error instanceof Error ? error.message : 'Could not switch to Bradbury.');
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function createItem() {
    if (!isBradbury) {
      setMessage('Switch to Bradbury before creating an item.');
      return;
    }

    if (!form.publicDescription || !form.hiddenDetail || !form.location) {
      setMessage('Fill public description, hidden owner detail, and location first.');
      return;
    }

    setIsBusy(true);
    try {
      const createdItemId = await readNextItemId();
      setNextItemId(createdItemId);
      const client = getWriteClient();
      const hash = await client.writeContract({
        address: contractAddress,
        functionName: 'create_item',
        args: [form.publicDescription, form.hiddenDetail, form.location],
        value: BigInt(0),
      });

      updateForm('itemId', String(createdItemId));
      saveTx(hash, 'create_item', `Create item #${createdItemId}: ${form.publicDescription}`);
      setMessage(`create_item submitted for item #${createdItemId}. Claim form is ready with the correct Item ID.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'create_item was rejected or failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function submitClaim() {
    if (!isBradbury) {
      setMessage('Switch to Bradbury before submitting a claim.');
      return;
    }

    const itemId = Number(form.itemId);
    if (!Number.isInteger(itemId) || itemId < 0) {
      setMessage('Item ID must be 0 or a positive number.');
      return;
    }

    if (!form.claimProof) {
      setMessage('Fill the claim proof before submitting.');
      return;
    }

    setIsBusy(true);
    try {
      const client = getWriteClient();
      const hash = await client.writeContract({
        address: contractAddress,
        functionName: 'submit_claim',
        args: [BigInt(itemId), form.claimProof],
        value: BigInt(0),
      });

      saveTx(hash, 'submit_claim', `Claim item #${itemId}`);
      setMessage('submit_claim submitted. Open the hash below to see consensus status in GenExplorer.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'submit_claim was rejected or failed.');
    } finally {
      setIsBusy(false);
    }
  }

  function updateForm(field: keyof TestForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a className="flex min-h-11 items-center gap-3" href="#" aria-label="LostLens home">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--ink)] text-base font-black text-white">
              LL
            </span>
            <span>
              <span className="block text-lg font-semibold leading-tight">LostLens</span>
              <span className="block text-xs text-[var(--muted)]">Real Bradbury contract flow</span>
            </span>
          </a>
          <a className="hidden text-sm font-semibold text-[var(--soft)] transition hover:text-[var(--ink)] sm:inline-flex" href="#test">
            Start test
          </a>
        </div>
      </header>

      <section id="test" className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:py-14">
        <div className="flex flex-col justify-between rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[0_24px_80px_rgba(20,32,28,0.08)] sm:p-8">
          <div>
            <div className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--soft)] shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
              Live on GenLayer Bradbury
            </div>
            <h1 className="text-5xl font-semibold leading-[1.02] sm:text-6xl">
              Create and claim a lost item on-chain.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--soft)]">
              Connect a wallet, switch to Bradbury, create a found item, then send a claim for
              that item. Every action returns a GenExplorer transaction hash.
            </p>
          </div>

          <div className="mt-8 grid gap-3">
            {steps.map((step, index) => (
              <div
                className={`flex items-center gap-3 rounded-md border p-3 ${
                  index <= currentStep ? 'border-[var(--line)] bg-white' : 'border-transparent bg-[#eef2ec]'
                }`}
                key={step}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                  index < currentStep ? 'bg-[var(--success)] text-white' : index === currentStep ? 'bg-[var(--ink)] text-white' : 'bg-white text-[var(--muted)]'
                }`}>
                  {index + 1}
                </span>
                <span className="font-medium">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-[var(--accent)]">LostLens console</p>
              <h2 className="mt-1 text-2xl font-semibold">Run the real contract</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">No preset data. Type your own item and claim proof.</p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${isBradbury ? 'bg-[var(--success-bg)] text-[var(--success-ink)]' : 'bg-[#f2efe2] text-[#7a6127]'}`}>
              {isBradbury ? 'Bradbury ready' : 'Needs Bradbury'}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              className="min-h-12 rounded-md bg-[var(--ink)] px-4 font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isBusy}
              onClick={connectWallet}
              type="button"
            >
              Connect wallet
            </button>
            <button
              className="min-h-12 rounded-md border border-[var(--line)] bg-white px-4 font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isBusy || !account}
              onClick={switchToBradbury}
              type="button"
            >
              Add / switch Bradbury
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-[var(--page)] p-3">
              <p className="text-xs uppercase text-[var(--muted)]">Wallet</p>
              <p className="mt-1 font-mono text-sm">{shortAccount}</p>
            </div>
            <div className="rounded-md bg-[var(--page)] p-3">
              <p className="text-xs uppercase text-[var(--muted)]">Chain</p>
              <p className="mt-1 font-mono text-sm">{chainId || '--'}</p>
            </div>
            <div className="rounded-md bg-[var(--page)] p-3">
              <p className="text-xs uppercase text-[var(--muted)]">Form</p>
              <p className="mt-1 text-sm font-semibold">{formSummary}</p>
            </div>
          </div>

          <p className="mt-4 rounded-md border border-[var(--line)] bg-[#fffaf2] p-3 text-sm leading-6 text-[var(--soft)]">
            {message}
          </p>

          <div className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--page)] p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--accent)]">Step 1</p>
                <h3 className="text-xl font-semibold">Create found item</h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">create_item</span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Public description
                <input
                  className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--accent)]"
                  onChange={(event) => updateForm('publicDescription', event.target.value)}
                  placeholder="Black backpack near library"
                  value={form.publicDescription}
                />
              </label>
              <label className="block text-sm font-medium">
                Location
                <input
                  className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--accent)]"
                  onChange={(event) => updateForm('location', event.target.value)}
                  placeholder="Library"
                  value={form.location}
                />
              </label>
            </div>

            <label className="mt-4 block text-sm font-medium">
              Hidden owner detail
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--accent)]"
                onChange={(event) => updateForm('hiddenDetail', event.target.value)}
                placeholder="Inside has blue keychain"
                value={form.hiddenDetail}
              />
            </label>

            <button
              className="mt-4 min-h-12 w-full rounded-md bg-[var(--accent)] px-5 font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isBusy || !account || !isBradbury}
              onClick={createItem}
              type="button"
            >
              Create item transaction
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-[var(--line)] bg-[#fffaf2] p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--accent)]">Step 2</p>
                <h3 className="text-xl font-semibold">Submit claim</h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">submit_claim</span>
            </div>

            <label className="mt-4 block text-sm font-medium">
              Item ID
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--accent)]"
                inputMode="numeric"
                onChange={(event) => updateForm('itemId', event.target.value)}
                placeholder="0"
                value={form.itemId}
              />
            </label>

            <label className="mt-4 block text-sm font-medium">
              Claim proof
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border border-[var(--line)] bg-white p-3 outline-none focus:border-[var(--accent)]"
                onChange={(event) => updateForm('claimProof', event.target.value)}
                placeholder="The backpack has a blue keychain inside."
                value={form.claimProof}
              />
            </label>

            <button
              className="mt-4 min-h-12 w-full rounded-md bg-[var(--ink)] px-5 font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isBusy || !account || !isBradbury}
              onClick={submitClaim}
              type="button"
            >
              Submit claim transaction
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--page)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
              <p className="text-sm font-semibold">Your real contract hashes</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Saved locally in this browser. New created item ID: {nextItemId ?? 'read after create'}.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">{txs.length}</span>
            </div>
            {txs.length ? (
              <div className="mt-4 space-y-3">
                {txs.map((tx) => (
                  <a
                    className="block rounded-md border border-[var(--line)] bg-white p-3 transition hover:border-[var(--accent)]"
                    href={`https://explorer-bradbury.genlayer.com/tx/${tx.hash}`}
                    key={`${tx.hash}-${tx.createdAt}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="block text-xs font-semibold uppercase text-[var(--accent)]">{tx.kind}</span>
                    <span className="mt-1 block text-sm font-semibold">{tx.label}</span>
                    <span className="mt-1 block break-all font-mono text-xs text-[var(--accent)]">{tx.hash}</span>
                    <span className="mt-1 block text-xs text-[var(--muted)]">{tx.createdAt}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-dashed border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]">
                No hashes yet. Create an item or submit a claim to see GenExplorer links here.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--ink)] py-12 text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 sm:px-8 lg:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <p className="text-sm text-white/50">Contract</p>
            <p className="mt-2 break-all font-mono text-sm">{contractAddress}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <p className="text-sm text-white/50">Real write methods</p>
            <p className="mt-2 leading-7">create_item(public, hidden, location) and submit_claim(item_id, proof).</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <p className="text-sm text-white/50">What to check</p>
            <p className="mt-2 leading-7">Open each hash in GenExplorer and wait for accepted or finalized consensus.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
