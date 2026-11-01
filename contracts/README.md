# VFXT Token Contracts

Hardhat + TypeScript project for the **Virtual FX Trades (VFXT)** ERC-20 token.

Firebase (Cloud Functions / Firestore) holds **off-chain** app logic separately. This package only contains the on-chain token.

## Token

| Field | Value |
| --- | --- |
| Name | VFXT |
| Symbol | VFXT |
| Decimals | 18 |
| Supply | Fixed **10,000,000,000,000** (10 trillion) — minted once in the constructor to a `treasury` address |
| Minting | No public or owner mint after deployment |

## Setup

```bash
cd contracts
cp .env.example .env   # then edit .env — never commit secrets
npm install
```

## Scripts

```bash
npm run compile        # compile Solidity (0.8.28)
npm test               # run unit tests
npm run deploy         # deploy to default Hardhat network (or --network localhost)
npm run deploy:sepolia # deploy to Sepolia (needs PRIVATE_KEY + SEPOLIA_RPC_URL)
npm run deploy:bsc     # deploy to BNB Smart Chain mainnet (needs PRIVATE_KEY; BNB for gas)
npm run clean          # remove artifacts / cache
```

### Deploy notes

- Default initial supply: `10_000_000_000_000` VFXT (18 decimals), minted to the deployer unless `TREASURY_ADDRESS` is set.
- Override with env: `INITIAL_SUPPLY`, `TREASURY_ADDRESS`.
- Put `PRIVATE_KEY` only in local `.env` — never commit it or paste it in chat.
- Deployer wallet must hold BNB for gas on mainnet.

## Swap desk (`VFXTSwap.sol`)

Fixed-price VFXT ↔ USDT swap that the admin funds and prices.

| Who | Function | What it does |
|---|---|---|
| User | `buy(usdtIn, minVfxtOut, deadline)` | Pay USDT, get VFXT at `buyPrice` (approve USDT first) |
| User | `sell(vfxtIn, minUsdtOut, deadline)` | Pay VFXT, get USDT at `sellPrice` (approve VFXT first) |
| Anyone | `quoteBuy`, `quoteSell`, `reserves`, `buyPrice`, `sellPrice` | Read-only, for the app and admin panel |
| Admin / price manager | `setPrices(buy, sell)` | Update prices; `0` turns a side off; sell must be ≤ buy |
| Admin | `deposit(token, amount)` | Add VFXT or USDT liquidity from the admin wallet (approve first) |
| Admin | `withdraw(token, to, amount)`, `withdrawAll(token, to)` | Send VFXT, USDT or any stuck token to any address, including the admin's own |
| Admin | `pause` / `unpause`, `setTradeLimits`, `setPriceManager` | Safety controls; withdrawals still work while paused |

Prices are **USDT per 1 VFXT scaled by 1e18**: 0.002 USDT → `2000000000000000`.
The `minOut` and `deadline` arguments mean a price change between quoting and mining can't fill a
user worse than they accepted. Ownership is two-step (`transferOwnership` + `acceptOwnership`) and
can't be renounced, so liquidity can never be locked.

Deploy: set the `SWAP_*` values in `.env` (see `.env.example`), then `npm run deploy:swap:bsc`.

## Networks

Configured in `hardhat.config.ts`:

- `hardhat` — in-process local network
- `localhost` — `http://127.0.0.1:8545`
- `sepolia` — URL/key from environment
- `bsc` — BNB Smart Chain mainnet (chainId 56)

## Security

- Do not commit `.env`, private keys, or mnemonic phrases.
- Contract uses OpenZeppelin `ERC20` and an SPDX `MIT` license identifier.
