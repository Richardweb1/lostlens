'use client';

import { useEffect, useMemo, useState } from 'react';

const contractAddress = '0x21833f0366e47AE826621A563346b9B107061155';
const explorerUrl = `https://explorer-bradbury.genlayer.com/address/${contractAddress}`;
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
  claimProof: string;
};

type LocalTx = {
  hash: string;
  label: string;
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
  claimProof: '',
};

const steps = [
  'Connect wallet',
  'Switch to Bradbury',
  'Submit test transaction',
  'Open transaction hash',
];

export default function Home() {
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState('');
  const [message, setMessage] = useState('Start by connecting your wallet.');
  const [isBusy, setIsBusy] = useState(false);
  const [form, setForm] = useState<TestForm>(emptyForm);
  const [txs, setTxs] = useState<LocalTx[]>([]);

  const hasWallet = typeof window !== 'undefined' && Boolean(window.ethereum);
  const isBradbury = chainId.toLowerCase() === bradburyChainId;
  const shortAccount = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected';
  const currentStep = !account ? 0 : !isBradbury ? 1 : txs.length === 0 ? 2 : 3;

  const formSummary = useMemo(() => {
    const filled = Object.values(form).filter(Boolean).length;
    return `${filled}/4 fields filled`;
  }, [form]);

  useEffect(() => {
    const saved = window.localStorage.getItem('lostlens-local-txs');
    if (saved) {
      try {
        setTxs(JSON.parse(saved) as LocalTx[]);
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

  function saveTx(hash: string) {
    const next = [
      {
        hash,
        label: form.publicDescription || form.claimProof || 'Bradbury wallet test',
        createdAt: new Date().toLocaleString(),
      },
      ...txs,
    ].slice(0, 5);

    setTxs(next);
    window.localStorage.setItem('lostlens-local-txs', JSON.stringify(next));
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
          ? 'Wallet and Bradbury are ready. Fill the form, then submit the transaction.'
          : 'Wallet connected. Click Add Bradbury before submitting.'
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
      setMessage('Bradbury is active. Fill any fields you want, then send a test transaction.');
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: number }).code : null;
      if (code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [bradburyChain],
        });
        setChainId(bradburyChain.chainId);
        setMessage('Bradbury was added. You can send a test transaction now.');
      } else {
        setMessage(error instanceof Error ? error.message : 'Could not switch to Bradbury.');
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function sendTestTransaction() {
    if (!window.ethereum || !account) {
      setMessage('Connect your wallet first.');
      return;
    }

    if (!isBradbury) {
      setMessage('Switch to Bradbury before sending the transaction.');
      return;
    }

    setIsBusy(true);
    try {
      const hash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: contractAddress,
            value: '0x0',
          },
        ],
      })) as string;

      saveTx(hash);
      setMessage('Transaction submitted. Open the hash below in GenExplorer.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Transaction was rejected or failed.');
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
              <span className="block text-xs text-[var(--muted)]">Try Bradbury in one flow</span>
            </span>
          </a>
          <a className="hidden text-sm font-semibold text-[var(--soft)] transition hover:text-[var(--ink)] sm:inline-flex" href="#test">
            Start test
          </a>
        </div>
      </header>

      <section id="test" className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:py-14">
        <div className="flex flex-col justify-between rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[0_24px_80px_rgba(20,32,28,0.08)] sm:p-8">
          <div>
            <div className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--soft)] shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
              Live on GenLayer Bradbury
            </div>
            <h1 className="text-5xl font-semibold leading-[1.02] sm:text-6xl">
              Test LostLens with your wallet.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--soft)]">
              Connect, switch to Bradbury, fill your own test details, then press Submit
              transaction. The site will show your transaction hash with a GenExplorer link.
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
              <p className="text-sm font-semibold uppercase text-[var(--accent)]">Test console</p>
              <h2 className="mt-1 text-2xl font-semibold">Start here</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Complete the steps from left to right, then submit from the form.</p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${isBradbury ? 'bg-[var(--success-bg)] text-[var(--success-ink)]' : 'bg-[#f2efe2] text-[#7a6127]'}`}>
              {isBradbury ? 'Network ready' : 'Needs Bradbury'}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
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
              Add Bradbury
            </button>
            <button
              className="min-h-12 rounded-md bg-[var(--accent)] px-4 font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isBusy || !account || !isBradbury}
              onClick={sendTestTransaction}
              type="button"
            >
              Quick submit
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Public description
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3 outline-none focus:border-[var(--accent)]"
                onChange={(event) => updateForm('publicDescription', event.target.value)}
                placeholder="Example: black backpack near library"
                value={form.publicDescription}
              />
            </label>
            <label className="block text-sm font-medium">
              Location
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3 outline-none focus:border-[var(--accent)]"
                onChange={(event) => updateForm('location', event.target.value)}
                placeholder="Where was it found?"
                value={form.location}
              />
            </label>
          </div>

          <label className="mt-4 block text-sm font-medium">
            Hidden owner detail
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3 outline-none focus:border-[var(--accent)]"
              onChange={(event) => updateForm('hiddenDetail', event.target.value)}
              placeholder="Only the real owner should know this"
              value={form.hiddenDetail}
            />
          </label>

          <label className="mt-4 block text-sm font-medium">
            Claim proof
            <textarea
              className="mt-2 min-h-28 w-full rounded-md border border-[var(--line)] p-3 outline-none focus:border-[var(--accent)]"
              onChange={(event) => updateForm('claimProof', event.target.value)}
              placeholder="Describe the detail you want validators to compare."
              value={form.claimProof}
            />
          </label>

          <div className="mt-5 rounded-lg border border-[var(--line)] bg-[#fffaf2] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold">Submit transaction</p>
                <p className="mt-1 text-sm leading-6 text-[var(--soft)]">
                  This sends a 0 GEN test transaction to the LostLens contract and returns your hash.
                </p>
              </div>
              <button
                className="min-h-12 rounded-md bg-[var(--accent)] px-5 font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isBusy || !account || !isBradbury}
                onClick={sendTestTransaction}
                type="button"
              >
                Submit transaction
              </button>
            </div>
            {!account ? (
              <p className="mt-3 text-sm text-[#7a6127]">Connect your wallet first.</p>
            ) : !isBradbury ? (
              <p className="mt-3 text-sm text-[#7a6127]">Click Add Bradbury before submitting.</p>
            ) : (
              <p className="mt-3 text-sm text-[var(--success-ink)]">Ready. Submit now to generate a transaction hash.</p>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--page)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Your transaction hashes</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Saved locally in this browser after each submission.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">{txs.length}</span>
            </div>
            {txs.length ? (
              <div className="mt-4 space-y-3">
                {txs.map((tx) => (
                  <a
                    className="block rounded-md border border-[var(--line)] bg-white p-3 transition hover:border-[var(--accent)]"
                    href={`https://explorer-bradbury.genlayer.com/tx/${tx.hash}`}
                    key={tx.hash}
                  >
                    <span className="block text-sm font-semibold">{tx.label}</span>
                    <span className="mt-1 block break-all font-mono text-xs text-[var(--accent)]">{tx.hash}</span>
                    <span className="mt-1 block text-xs text-[var(--muted)]">{tx.createdAt}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-dashed border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]">
                No hashes yet. Connect your wallet and send a test transaction.
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
            <p className="text-sm text-white/50">What is tested</p>
            <p className="mt-2 leading-7">Wallet connection, Bradbury chain setup, and transaction hash visibility.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <p className="text-sm text-white/50">Next product step</p>
            <p className="mt-2 leading-7">Wire the form to real LostLens create and claim contract calls.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
