# LostLens

LostLens is a GenLayer-powered lost-and-found dApp. A finder registers a lost item with public details and a private identifying detail. A claimant then submits proof, and GenLayer validators decide whether the claim matches the hidden detail.

Live site:

```text
https://lostlens.vercel.app
```

Bradbury contract:

```text
0x21833f0366e47AE826621A563346b9B107061155
```

## What It Does

- Connects an EIP-1193 wallet such as MetaMask.
- Adds or switches the wallet to GenLayer Bradbury Testnet.
- Sends a real `create_item` transaction to the LostLens contract.
- Auto-fills the correct item ID for the claim step.
- Sends a real `submit_claim` transaction.
- Saves each transaction hash locally and links it to GenExplorer.

## Verified Test Flow

A full end-to-end Bradbury test has been completed:

```text
create_item("wallet1", "owner1", "library")
submit_claim(2, "owner1")
```

The claim transaction finalized with:

```text
STRONG_MATCH
```

Claim transaction:

```text
0x8ad6e101bc401374166cb4f670ab6524294db36cee8f87d917d8aed22543ec78
```

## Contract Methods

The intelligent contract is in `contracts/LostLens.py`.

Write methods:

- `create_item(public_description, hidden_description, location)`
- `submit_claim(item_id, claimant_description)`

Read methods:

- `get_item(item_id)`
- `get_all_items()`
- `get_item_count()`

Possible validator verdicts:

- `STRONG_MATCH`
- `POSSIBLE_MATCH`
- `NOT_A_MATCH`

A `STRONG_MATCH` marks the item as `claimed`.

## Project Structure

```text
contracts/LostLens.py        GenLayer intelligent contract
tests/direct/                Direct-mode contract tests
app/                         Next.js app used by Vercel
frontend/                    Workspace copy of the same frontend page
```

## Run Locally

Install dependencies:

```powershell
npm install
```

Start the frontend:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

Build for production:

```powershell
npm run build
```

## Contract Checks

Run the GenVM linter:

```powershell
genvm-lint check contracts/LostLens.py
```

Run direct-mode tests:

```powershell
pytest tests/direct/ -v
```

## Deploy To Vercel

Import this repository into Vercel and use:

- Framework Preset: `Next.js`
- Root Directory: empty / repository root
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: default

No environment variables are required for the current frontend.

## Privacy Note

`hidden_description` is not returned by the public read methods, but GenLayer contract state is not encrypted. Do not store passwords, full IDs, private contact details, or highly sensitive secrets in it.
