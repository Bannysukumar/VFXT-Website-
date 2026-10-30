# VFXT Platform — Virtual FX Trades

React + TypeScript + Vite frontend, Firebase backend (Auth, Firestore, Functions 2nd gen, Storage, Hosting, App Check), and a separate Hardhat ERC-20 contract for the future VFXT token.

## Principles

- Frontend never authorizes financial outcomes or balances.
- Integer minor units for money; no floating-point ledger math.
- Cloud Functions + Firestore rules enforce permissions.
- Staking rewards / blockchain features stay disabled until verified.
- Secrets live in Firebase Secret Manager — never in `VITE_*` vars.

## Repository layout

```
src/                 Feature-based React app
functions/           Cloud Functions (TypeScript)
contracts/           Hardhat VFXT ERC-20
firestore.rules      Database security rules
storage.rules        Storage security rules
firebase.json        Hosting, emulators, functions
.github/workflows    CI (typecheck, lint, tests, build, contracts)
```

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

### Emulators

```bash
npx firebase emulators:start
# set VITE_USE_FIREBASE_EMULATORS=true in .env.local
```

### Cloud Functions

```bash
cd functions && npm install && npm run build
```

### Token contract

```bash
cd contracts && npm install && npm test
```

## Admin bootstrap

1. Deploy functions with `BOOTSTRAP_SECRET` in Secret Manager.
2. Sign in as the first user.
3. Call `bootstrapFirstAdmin` once (Admin UI includes a temporary form).
4. Rotate/disable the secret after use.

## Environments

`.firebaserc` aliases: `dev`, `staging`, `prod`. Deploy hosting + functions per project; never reuse production secrets in development.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run ci` | Full local CI gate |

## Phased delivery status

1. Repository + design system — done
2. Public website — done
3. Firebase Authentication UI + wiring — done
4. Firestore models + security rules — done
5. User dashboard — done
6. Admin dashboard + roles model — done (server modules in `functions/`)
7. Ledger workflows — done (Functions)
8. Deposit / withdrawal integrations — scaffold + callables
9. Token contract + tests — `contracts/`
10. Blockchain adapter — stubbed / feature-flagged
11. CI + deployment configs — done
