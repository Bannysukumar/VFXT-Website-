import { ethers, network, run } from "hardhat";

/**
 * Deploys VFXTToken with a fixed supply minted to a treasury address.
 * On live networks, also attempts BscScan/Etherscan verification when an API key is set.
 *
 * Env (optional):
 * - TREASURY_ADDRESS — recipient of initial supply (defaults to deployer)
 * - INITIAL_SUPPLY — human-readable token amount, e.g. "1000000000" (defaults to 1_000_000_000)
 * - VERIFY_CONTRACT — set to "false" to skip verification
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const treasury = process.env.TREASURY_ADDRESS ?? deployer.address;
  const initialSupplyHuman = process.env.INITIAL_SUPPLY ?? "1000000000";
  const initialSupply = ethers.parseUnits(initialSupplyHuman, 18);

  console.log("Deploying VFXTToken");
  console.log("  network:       ", network.name);
  console.log("  chainId:       ", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("  deployer:      ", deployer.address);
  console.log("  treasury:      ", treasury);
  console.log("  initialSupply: ", initialSupplyHuman, "VFXT");

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("  deployer BNB:  ", ethers.formatEther(balance));
  if (balance === 0n) {
    throw new Error("Deployer has 0 balance — send BNB for gas before deploying.");
  }

  const factory = await ethers.getContractFactory("VFXTToken");
  const token = await factory.deploy(initialSupply, treasury);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("VFXTToken deployed to:", address);
  console.log("  name:           ", await token.name());
  console.log("  symbol:         ", await token.symbol());
  console.log("  decimals:       ", await token.decimals());
  console.log("  totalSupply:    ", (await token.totalSupply()).toString());
  console.log("  treasury balance:", (await token.balanceOf(treasury)).toString());

  const shouldVerify =
    process.env.VERIFY_CONTRACT !== "false" &&
    network.name !== "hardhat" &&
    network.name !== "localhost";

  if (shouldVerify) {
    console.log("Waiting for block explorer indexing before verify...");
    await new Promise((r) => setTimeout(r, 15000));
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [initialSupply, treasury],
      });
      console.log("Contract verified on block explorer.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (/already verified/i.test(message)) {
        console.log("Contract already verified.");
      } else {
        console.warn("Verification failed:", message);
        console.warn(
          `Retry later with:\n  npx hardhat verify --network ${network.name} ${address} ${initialSupply.toString()} ${treasury}`
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
