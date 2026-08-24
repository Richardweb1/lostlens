'use client';

import { useState } from 'react';

const contractAddress = '0x21833f0366e47AE826621A563346b9B107061155';
const explorerUrl = `https://explorer-bradbury.genlayer.com/address/${contractAddress}`;

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const bradburyChain = {
  chainId: '0x107d',
  chainName: 'GenLayer Bradbury Testnet',
  nativeCurrency: {
    name: 'GEN',
    symbol: 'GEN',
    decimals: 18,
  },
  rpcUrls: ['https://rpc-bradbury.genlayer.com'],
  blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
};

const stats = [
  { label: 'Registered items', value: '00' },
  { label: 'Submitted claims', value: '00' },
  { label: 'Latest verdict', value: '--' },
];

const timeline = [
  {
    step: 'Register',
    title: 'Finder publishes safe details',
    body: 'The public description helps people identify the item without exposing the private proof.',
  },
  {
    step: 'Prove',
    title: 'Claimant submits hidden context',
    body: 'The claimant describes a detail only the owner is likely to know.',
  },
  {
    step: 'Resolve',
    title: 'GenLayer validators judge the match',
    body: 'Consensus returns STRONG_MATCH, POSSIBLE_MATCH, or NOT_A_MATCH and updates the registry.',
  },
];

const items: Array<{ id: string; name: string; location: string; status: string; verdict: string }> = [];

export default function Home() {
  const [account, setAccount] = useState('');
  const [chainReady, setChainReady] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [walletMessage, setWalletMessage] = useState('Connect a browser wallet to run a Bradbury network test.');
  const [isBusy, setIsBusy] = useState(false);

  const shortAccount = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected';

  async function connectWallet() {
    if (!window.ethereum) {
      setWalletMessage('No wallet found. Install MetaMask or another EIP-1193 wallet.');
      return;
    }

    setIsBusy(true);
    try {
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      setAccount(accounts[0] ?? '');
      setWalletMessage('Wallet connected. Switch to Bradbury to continue.');
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : 'Wallet connection was rejected.');
    } finally {
      setIsBusy(false);
    }
  }

  async function switchToBradbury() {
    if (!window.ethereum) {
      setWalletMessage('No wallet found. Install MetaMask or another EIP-1193 wallet.');
      return;
    }

    setIsBusy(true);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: bradburyChain.chainId }],
      });
      setChainReady(true);
      setWalletMessage('Bradbury is active. You can send a test transaction now.');
    } catch (error) {
      const maybeCode = typeof error === 'object' && error && 'code' in error ? (error as { code?: number }).code : null;
      if (maybeCode === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [bradburyChain],
        });
        setChainReady(true);
        setWalletMessage('Bradbury was added to your wallet.');
      } else {
        setWalletMessage(error instanceof Error ? error.message : 'Could not switch to Bradbury.');
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function sendTestTransaction() {
    if (!window.ethereum || !account) {
      setWalletMessage('Connect your wallet first.');
      return;
    }

    setIsBusy(true);
    setTxHash('');
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
      setTxHash(hash);
      setWalletMessage('Test transaction submitted. Open the hash in GenExplorer.');
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : 'Transaction was rejected or failed.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(247,248,244,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a className="flex min-h-11 items-center gap-3" href="#" aria-label="LostLens home">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--ink)] text-base font-black text-white">
              LL
            </span>
            <span>
              <span className="block text-lg font-semibold leading-tight">LostLens</span>
              <span className="block text-xs text-[var(--muted)]">Bradbury registry</span>
            </span>
          </a>
          <nav className="hidden items-center gap-1 text-sm font-medium text-[var(--soft)] md:flex">
            <a className="rounded-md px-3 py-2 hover:bg-white" href="#flow">Flow</a>
            <a className="rounded-md px-3 py-2 hover:bg-white" href="#registry">Registry</a>
            <a className="rounded-md px-3 py-2 hover:bg-white" href="#claim">Claim</a>
          </nav>
          <a
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-strong)]"
            href={explorerUrl}
          >
            View contract
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <div className="absolute inset-x-0 top-0 h-64 bg-[linear-gradient(90deg,rgba(23,94,78,0.14),rgba(192,85,56,0.11),rgba(247,248,244,0))]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--soft)] shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
              Live contract on GenLayer Bradbury
            </div>
            <h1 className="text-5xl font-semibold leading-[1.02] sm:text-7xl">
              Lost items, verified by consensus.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--soft)]">
              LostLens is a clean on-chain lost-and-found experience where finders list items,
              owners prove private details, and GenLayer validators decide the match.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-[var(--ink)] px-5 font-semibold text-white transition hover:bg-black"
                href="#claim"
              >
                Test the claim flow
              </a>
              <a
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-[var(--line)] bg-white px-5 font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]"
                href="#registry"
              >
                See registry
              </a>
            </div>

            <div className="mt-8 rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">Wallet test</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Connected account: {shortAccount}</p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${chainReady ? 'bg-[var(--success-bg)] text-[var(--success-ink)]' : 'bg-[#f2efe2] text-[#7a6127]'}`}>
                  {chainReady ? 'Bradbury ready' : 'Bradbury needed'}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  className="min-h-11 rounded-md bg-[var(--ink)] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy}
                  onClick={connectWallet}
                  type="button"
                >
                  Connect wallet
                </button>
                <button
                  className="min-h-11 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy}
                  onClick={switchToBradbury}
                  type="button"
                >
                  Add Bradbury
                </button>
                <button
                  className="min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy || !account}
                  onClick={sendTestTransaction}
                  type="button"
                >
                  Send test tx
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--soft)]">{walletMessage}</p>
              {txHash ? (
                <a
                  className="mt-3 block break-all rounded-md bg-[#f7f8f4] p-3 font-mono text-sm font-semibold text-[var(--accent)]"
                  href={`https://explorer-bradbury.genlayer.com/tx/${txHash}`}
                >
                  {txHash}
                </a>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_24px_80px_rgba(20,32,28,0.10)]">
            <div className="rounded-md bg-[var(--ink)] p-5 text-white">
              <p className="text-sm text-white/62">Contract address</p>
              <p className="mt-3 break-all font-mono text-sm leading-6">{contractAddress}</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-md border border-[var(--line)] bg-white p-4">
                  <p className="text-2xl font-semibold">{stat.value}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-[var(--line)] bg-[#f9faf4] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-[var(--muted)]">Latest outcome</p>
                  <p className="mt-1 text-xl font-semibold">No transactions yet</p>
                </div>
                <span className="rounded-full bg-[#f2efe2] px-3 py-1 text-sm font-semibold text-[#7a6127]">
                  empty
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#dde8df]">
                <div className="h-full w-0 rounded-full bg-[var(--success)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="flow" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase text-[var(--accent)]">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Simple enough for users, strict enough for settlement.</h2>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {timeline.map((item) => (
            <article key={item.step} className="rounded-lg border border-[var(--line)] bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-[var(--accent)]">{item.step}</p>
              <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 leading-7 text-[var(--soft)]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="registry" className="bg-[var(--ink)] py-14 text-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-white/55">Registry</p>
              <h2 className="mt-2 text-3xl font-semibold">Items in the demo ledger</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/60">
              New visitors start from a clean slate. Connect a wallet, add Bradbury, then submit their own test transaction.
            </p>
          </div>
          {items.length ? (
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {items.map((item) => (
              <article key={item.id} className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/50">Item {item.id}</p>
                    <h3 className="mt-1 text-2xl font-semibold">{item.name}</h3>
                    <p className="mt-2 text-sm text-white/58">{item.location}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[var(--ink)]">
                    {item.status}
                  </span>
                </div>
                <div className="mt-6 rounded-md bg-black/20 p-4">
                  <p className="text-xs uppercase text-white/45">Validator verdict</p>
                  <p className="mt-1 font-mono text-sm">{item.verdict}</p>
                </div>
              </article>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-lg border border-dashed border-white/18 bg-white/[0.04] p-8">
              <p className="text-2xl font-semibold">No public demo items yet.</p>
              <p className="mt-3 max-w-2xl leading-7 text-white/60">
                Use the wallet test above to create your own Bradbury transaction hash. The next integration step will read live contract state and render every submitted item here.
              </p>
            </div>
          )}
        </div>
      </section>

      <section id="claim" className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-semibold uppercase text-[var(--accent)]">Claim test</p>
          <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Start from empty fields and test your own claim.</h2>
          <p className="mt-4 leading-7 text-[var(--soft)]">
            Every visitor can connect a wallet, switch to Bradbury, and submit a test transaction.
            Keep the form blank so they can choose the item and proof they want to try.
          </p>
        </div>
        <form className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Item ID
              <input className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3 outline-none focus:border-[var(--accent)]" placeholder="0" />
            </label>
            <label className="block text-sm font-medium">
              Location
              <input className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3 outline-none focus:border-[var(--accent)]" placeholder="Where was it found?" />
            </label>
          </div>
          <label className="mt-4 block text-sm font-medium">
            Claimant proof
            <textarea className="mt-2 min-h-32 w-full rounded-md border border-[var(--line)] p-3 outline-none focus:border-[var(--accent)]" placeholder="Describe the private detail only the owner should know." />
          </label>
          <button className="mt-5 min-h-12 w-full rounded-md bg-[var(--accent)] px-4 font-semibold text-white transition hover:bg-[var(--accent-strong)]" type="button">
            Prepare transaction
          </button>
        </form>
      </section>
    </main>
  );
}
