# LostLens

LostLens is a GenLayer-powered lost-and-found project. A finder registers an item with public details plus a private identifying detail. A claimant submits proof, and GenLayer validators decide whether the claim is a match.

The current Bradbury contract is:

```text
0x21833f0366e47AE826621A563346b9B107061155
```

## Project Structure

```text
contracts/LostLens.py        GenLayer intelligent contract
tests/direct/                Direct-mode contract tests
app/                         Next.js app entry for Vercel
frontend/                    Same frontend source kept as a workspace copy
```

## Contract

The contract exposes:

- `create_item(public_description, hidden_description, location)`
- `submit_claim(item_id, claimant_description)`
- `get_item(item_id)`
- `get_all_items()`
- `get_item_count()`

The tested flow is:

1. Finder creates an item.
2. Claimant submits a private description.
3. Validators return `STRONG_MATCH`, `POSSIBLE_MATCH`, or `NOT_A_MATCH`.
4. A `STRONG_MATCH` marks the item as `claimed`.

## Contract Checks

```powershell
genvm-lint check contracts/LostLens.py
pytest tests/direct/ -v
```

## Frontend

```powershell
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Production build:

```powershell
npm run build
```

## Deploy To Vercel

Import this repository in Vercel and set:

- Root Directory: leave empty
- Framework Preset: `Next.js`
- Build Command: `npm run build`
- Install Command: `npm install`
- Output Directory: leave empty / default

No environment variables are required for the current static demo frontend.

## Privacy Note

`hidden_description` is not returned by view methods, but GenLayer contract state is not encrypted. Do not store passwords, full IDs, private contact details, or highly sensitive secrets in it.
