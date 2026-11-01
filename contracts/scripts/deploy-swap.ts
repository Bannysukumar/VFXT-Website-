import { ethers, network, run } from "hardhat";

/**
 * Deploys VFXTSwap (fixed-price VFXT <-> USDT desk).
 *
 * Env (optional unless noted):
 * - SWAP_ADMIN          — owner/admin wallet (defaults to deployer). Use the treasury or a hardware wallet.
 * - VFXT_ADDRESS        — defaults to the live BSC VFXT 0x4A08EF10e6f4aa077A74496793467d2192061969
 * - USDT_ADDRESS        — defaults to BSC USDT 0x55d398326f99059fF775485246999027B3197955 (18 decimals)
 * - SWAP_BUY_PRICE      — USDT per 1 VFXT when users buy,  e.g. "0.002" (default 0 = buying off)
 * - SWAP_SELL_PRICE     — USDT per 1 VFXT when users sell, e.g. "0.0018" (default 0 = selling off)
 * - VERIFY_CONTRACT     — "false" to skip explorer verification
 *
 * After deploying, fund it from the admin wallet: approve, then call deposit(token, amount).
 */
const BSC_VFXT = "0x4A08EF10e6f4aa077A74496793467d2192061969";
const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const isBsc = chainId === 56n;

  const admin = process.env.SWAP_ADMIN ?? deployer.address;
  const vfxt = process.env.VFXT_ADDRESS ?? (isBsc ? BSC_VFXT : "");
  const usdt = process.env.USDT_ADDRESS ?? (isBsc ? BSC_USDT : "");
  if (!vfxt || !usdt) throw new Error("Set VFXT_ADDRESS and USDT_ADDRESS for this network.");
  for (const [label, value] of [["SWAP_ADMIN", admin], ["VFXT_ADDRESS", vfxt], ["USDT_ADDRESS", usdt]]) {
    if (!ethers.isAddress(value)) throw new Error(`${label} is not a valid address: ${value}`);
  }

  const buyPrice = ethers.parseUnits(process.env.SWAP_BUY_PRICE ?? "0", 18);
  const sellPrice = ethers.parseUnits(process.env.SWAP_SELL_PRICE ?? "0", 18);
  if (buyPrice !== 0n && sellPrice > buyPrice) throw new Error("SWAP_SELL_PRICE must not exceed SWAP_BUY_PRICE.");

  console.log("Deploying VFXTSwap");
  console.log("  network:   ", network.name, `(chainId ${chainId})`);
  console.log("  deployer:  ", deployer.address);
  console.log("  admin:     ", admin);
  console.log("  VFXT:      ", vfxt);
  console.log("  USDT:      ", usdt);
  console.log("  buyPrice:  ", ethers.formatUnits(buyPrice, 18), "USDT per VFXT");
  console.log("  sellPrice: ", ethers.formatUnits(sellPrice, 18), "USDT per VFXT");

  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) throw new Error("Deployer has 0 balance — send BNB for gas before deploying.");

  const factory = await ethers.getContractFactory("VFXTSwap");
  const args = [vfxt, usdt, admin, buyPrice, sellPrice] as const;
  const swap = await factory.deploy(...args);
  await swap.waitForDeployment();
  const address = await swap.getAddress();
  console.log("VFXTSwap deployed to:", address);

  const shouldVerify = process.env.VERIFY_CONTRACT !== "false" && network.name !== "hardhat" && network.name !== "localhost";
  if (shouldVerify) {
    console.log("Waiting for block explorer indexing before verify...");
    await new Promise((r) => setTimeout(r, 15000));
    try {
      await run("verify:verify", { address, constructorArguments: [...args] });
      console.log("Contract verified on block explorer.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (/already verified/i.test(message)) console.log("Contract already verified.");
      else {
        console.warn("Verification failed:", message);
        console.warn(`Retry later with:\n  npx hardhat verify --network ${network.name} ${address} ${args.map(String).join(" ")}`);
      }
    }
  }

  console.log("\nNext steps (from the admin wallet):");
  console.log("  1. VFXT.approve(swap, amount) and USDT.approve(swap, amount)");
  console.log("  2. swap.deposit(VFXT, amount) / swap.deposit(USDT, amount)");
  console.log("  3. swap.setPrices(buy, sell) whenever the price changes");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
