# VFXT Wallet — Production release runbook

The debug APK is for testing only. Do **not** tell users to deposit real funds until every gate
below is checked off.

All secrets go in `android app/local.properties` (git-ignored). Nothing secret belongs in source.

---

## Gate 1 — Release signing keystore

The keystore is the app's permanent identity. If it is lost, installed apps can never be updated
with the same package name. If it leaks, someone can ship a fake "update".

1. Create it **outside** any synced/shared folder you don't control (the repo ignores `*.jks`,
   `*.keystore` and `/keystore/`, but keep an offline backup regardless):

   ```powershell
   mkdir "C:\Users\banny\Downloads\New folder (10)\keystore"
   keytool -genkeypair -v -keystore "C:\Users\banny\Downloads\New folder (10)\keystore\vfxt-release.jks" `
     -alias vfxt -keyalg RSA -keysize 4096 -validity 10000
   ```
   `keytool` prompts for passwords and the certificate name; choose long unique passwords and
   store them in a password manager.

2. Add to `android app/local.properties` (path is relative to the `android app` folder):

   ```properties
   vfxt.storeFile=../keystore/vfxt-release.jks
   vfxt.storePassword=<store password>
   vfxt.keyAlias=vfxt
   vfxt.keyPassword=<key password>
   ```

3. Build and confirm the APK is signed:

   ```powershell
   cd "C:\Users\banny\Downloads\New folder (10)\android app"
   .\gradlew.bat :app:assembleRelease
   & "$env:LOCALAPPDATA\Android\Sdk\build-tools\<version>\apksigner.bat" verify --print-certs `
     app\build\outputs\apk\release\app-release.apk
   ```
   Output: `app/build/outputs/apk/release/app-release.apk` (not `-unsigned`).

4. Back up: the `.jks` file + both passwords, in two separate offline locations.
   For Google Play, enrol in Play App Signing so Google holds the app signing key and this file
   becomes the upload key.

- [ ] Keystore created and backed up offline
- [ ] `assembleRelease` produces a signed `app-release.apk`; `apksigner verify` passes

## Gate 2 — Configuration

```properties
# WalletConnect (Reown Cloud → create project → copy Project ID)
vfxt.walletConnectProjectId=<project id>

# VFXT BEP-20 contract addresses, only after deployment AND on-chain verification
vfxt.tokenMainnet=0x...
vfxt.tokenTestnet=0x...

# Optional: Etherscan V2 key for incoming-transfer history
bscscan.apiKey=<key>
```

- **WalletConnect** (Reown WalletKit): until the Project ID is set, the WalletConnect screen shows a
  "not configured" notice and pairing is disabled. In Reown Cloud, allow-list the package
  `com.vfxt.wallet`. Supported requests: `eth_sendTransaction`, `personal_sign`,
  `eth_signTypedData(_v4)`; `eth_sign` is refused on purpose. Every connection and request needs
  explicit approval, and signing also needs PIN/biometrics. Pairing works by QR scan (WalletConnect
  screen or Home scanner) and by `wc:` links from dApps on the same phone.
- **VFXT token**: until set, VFXT shows "Not deployed yet" and is never queried or sendable.
  Before setting it, verify on BscScan that the contract is the deployed `VFXTToken`, then check
  in-app (Add custom token reads symbol/decimals from chain) that it reports `VFXT` / `18`.
- Values are compiled into the APK at build time: rebuild after any change.

- [ ] WalletConnect Project ID set; pairing tested with a dApp on testnet
- [ ] VFXT addresses set (or consciously left unset for this release)

## Gate 3 — Device hygiene before smoke testing

- [ ] Remove any wallet derived from the public test phrase `abandon … about`
      (`0x9858EfFD232B4033E47d90003D41EC34EcaEda94`). Its key is public; anything sent there can be
      taken by anyone. The app now blocks importing it, but older test installs may still hold it.
- [ ] Install the **signed release** APK (uninstall the debug build first; signatures differ).

## Gate 4 — Testnet smoke (BSC Testnet, chain 97)

Get free tBNB from the official BNB Chain testnet faucet for a freshly created wallet.

- [ ] Create a new wallet in the release APK, back up phrase, set PIN
- [ ] Receive: faucet tBNB arrives; balance updates after pull-to-refresh
- [ ] Send 0.001 tBNB to a second wallet you control; review screen shows correct address, fee, total
- [ ] Transaction confirms in-app; hash opens on testnet.bscscan.com; recipient balance matches
- [ ] Restore the same phrase in MetaMask or Trust Wallet: same address, same balance
- [ ] Lock / auto-lock / wrong-PIN lockout behave as expected
- [ ] Mining start / claim and booster purchase complete against the testnet backend config

## Gate 5 — Mainnet smoke (tiny amounts only)

Use amounts you can afford to lose entirely (for example ≤ 1 USD).

- [ ] Receive ~1 USD of BNB from an exchange or another wallet you control
- [ ] USD value and 24h change display; price source fallback works with network toggled off/on
- [ ] Send a small BNB amount to a second wallet you control; confirm on bscscan.com
- [ ] Send a small USDT (BEP-20) amount; token transfer confirms; fee paid in BNB
- [ ] Incoming history (if `bscscan.apiKey` set) shows the received transfer
- [ ] Cross-check the final balances in MetaMask/Trust with the same phrase

Only after Gates 1–5 pass: announce deposits, and keep the Trade tab clearly labelled DEMO.
