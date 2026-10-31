# VFXT Token Contracts

Hardhat + TypeScript project for the **Virtual FX Trades (VFXT)** ERC-20 token.

Firebase (Cloud Functions / Firestore) holds **off-chain** app logic separately. This package only contains the on-chain token.

## Token

| Field | Value |
| --- | --- |
| Name | Virtual FX Trades |
| Symbol | VFXT |
| Decimals | 18 |
| Supply | Fixed — minted once in the constructor to a `treasury` address |
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

- Default initial supply: `1_000_000_000` VFXT (18 decimals), minted to the deployer unless `TREASURY_ADDRESS` is set.
- Override with env: `INITIAL_SUPPLY`, `TREASURY_ADDRESS`.
- Put `PRIVATE_KEY` only in local `.env` — never commit it or paste it in chat.
- Deployer wallet must hold BNB for gas on mainnet.

## Networks

Configured in `hardhat.config.ts`:

- `hardhat` — in-process local network
- `localhost` — `http://127.0.0.1:8545`
- `sepolia` — URL/key from environment
- `bsc` — BNB Smart Chain mainnet (chainId 56)

## Security

- Do not commit `.env`, private keys, or mnemonic phrases.
- Contract uses OpenZeppelin `ERC20` and an SPDX `MIT` license identifier.
