export const commonFaqs = [
  {
    q: 'How long do deposits take to appear?',
    a: 'Deposit requests are reviewed by finance admins. Your balance updates as soon as the request is approved and the ledger entry is written — you can follow the status from your dashboard.',
  },
  {
    q: 'Why is part of my balance shown as reserved?',
    a: 'When you request a withdrawal, funds move from available to reserved so they cannot be spent twice. They leave your wallet once the withdrawal completes, or return to available if it is rejected.',
  },
  {
    q: 'Can a retry create a duplicate transaction?',
    a: 'No. Every financial request carries an idempotency key, so repeated submissions of the same request are recognised and ignored by the server.',
  },
  {
    q: 'Is the VFXT token live?',
    a: 'Yes. VFXT / VFXT is a fixed-supply BEP-20 on BNB Smart Chain (10,000,000,000,000 — 10 trillion). Contract: 0x4A08EF10e6f4aa077A74496793467d2192061969. Treasury: 0x76b16F59Cfab5DdaE5D149BE98E5d755F939572A. App ledger balances still settle server-side until full on-chain settlement is enabled for every product flow.',
  },
  {
    q: 'Which networks and assets do you support?',
    a: 'On the web platform, deposits and withdrawals use USDT on BNB Smart Chain (BEP-20), plus USD ledger balances and VFXT. The Android VFXT Wallet also supports multi-chain EVM send, receive, and swap.',
  },
  {
    q: 'How do daily staking rewards work?',
    a: 'Daily income stakes credit about 1% every 24 hours from your exact stake time into the Daily ROI wallet, until the day cap or payout cap is reached. This is separate from Android mining sessions.',
  },
  {
    q: 'Can I send funds to another member?',
    a: 'Yes. Use Transfer with their User ID (for example VFXT2533) to send VFXT or Withdrawal USD. Internal moves between your own wallets are on the same page.',
  },
  {
    q: 'Who can change my withdrawal address?',
    a: 'After your first successful payout, that address is saved for safety. Contact support if you need it updated.',
  },
  {
    q: 'What is the difference between the website and VFXT Wallet?',
    a: 'The website is the Virtual FX Trades platform: email accounts, ledger wallets, deposits, stakes, referrals, and reviewed withdrawals. VFXT Wallet is the Android self-custody app for on-chain assets, swaps, and mining.',
  },
  {
    q: 'Where do I download the Android wallet?',
    a: 'Only from the official Download page on this website. Do not install APKs from unknown mirrors or chat links.',
  },
]

export const walletFaqs = [
  {
    q: 'Does VFXT store my recovery phrase?',
    a: 'No. Phrases and private keys are encrypted in an on-device vault. Android backup for app data is disabled. VFXT will never ask for your recovery phrase.',
  },
  {
    q: 'Can I use more than one wallet?',
    a: 'Yes. Create or import multiple wallets, rename them, switch the active wallet, and reveal a phrase or key only after confirming with your PIN.',
  },
  {
    q: 'Which networks are built in?',
    a: 'BNB Smart Chain (default), Ethereum, Polygon, Arbitrum One, Optimism, Base, Avalanche C-Chain, plus BSC and Sepolia testnets. You can also add a custom RPC network.',
  },
  {
    q: 'How do swaps work?',
    a: 'Swaps and bridges run through LI.FI. You review the quote, slippage, and gas, then sign. The wallet avoids unlimited token approvals.',
  },
  {
    q: 'Is the Trade tab real trading?',
    a: 'No. Trade is a demo preview with simulated charts and orders. It does not move funds from your self-custody wallet.',
  },
  {
    q: 'How do I lock the app?',
    a: 'Set a PIN after wallet setup, optionally enable biometrics, and choose an auto-lock interval (immediate, 1, 5, or 15 minutes). You can also lock immediately from security settings.',
  },
]

export const miningFaqs = [
  {
    q: 'Where is mining available?',
    a: 'In the Mining tab of the VFXT Wallet Android app. Install the official APK, create or import a wallet, then open Mining.',
  },
  {
    q: 'Who decides mining rates and caps?',
    a: 'VFXT servers. The phone shows session length, estimates, and caps from the backend so every member follows the same programme rules.',
  },
  {
    q: 'How do I claim rewards?',
    a: 'When available rewards clear the minimum threshold, use Claim VFXT in the Mining tab to send rewards to your self-custody wallet address.',
  },
  {
    q: 'What are speed boosters?',
    a: 'Optional upgrades from the in-app catalog. You pay with USDT (BEP-20) by signing a transfer from the active wallet — never by pasting a private key into a website.',
  },
  {
    q: 'Is mining the same as daily income staking?',
    a: 'No. Mining is an Android wallet feature that claims VFXT on-chain. Daily income stakes live on the web platform ledger and credit Daily ROI on a per-stake 24-hour clock.',
  },
  {
    q: 'How does mining sign-in work?',
    a: 'Mining uses a wallet signature to establish a VFXT account session. You stay in control of the keys; the signature proves address ownership.',
  },
]

/** Edit to match your real staffing before launch. */
export const supportHours = {
  timezone: 'All times in UTC',
  schedule: [
    { days: 'Monday – Friday', hours: '09:00 – 18:00' },
    { days: 'Saturday', hours: '10:00 – 14:00' },
    { days: 'Sunday & public holidays', hours: 'Closed' },
  ],
  note: 'Tickets can be opened at any time and are answered in order during support hours.',
}

/** US head office shown on the Contact page. */
export const officeLocation = {
  label: 'Head office',
  company: 'Virtual FX Trades',
  street: 'Niagara Chairs, 60 Jade Dr',
  city: 'Rochester, NY',
  postcode: '14626',
  country: 'United States',
  /** Opening hours for walk-in visits; set to null to hide. */
  visiting: 'Visits by appointment only',
}
