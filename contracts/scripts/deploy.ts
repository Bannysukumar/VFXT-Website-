import { ethers } from "hardhat";

/**
 * Deploys VFXTToken with a fixed supply minted to a treasury address.
 *
 * Env (optional):
 * - TREASURY_ADDRESS — recipient of initial supply (defaults to deployer)
 * - INITIAL_SUPPLY — human-readable token amount, e.g. "1000000000" (defaults to 1_000_000_000)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const treasury = process.env.TREASURY_ADDRESS ?? deployer.address;
  const initialSupplyHuman = process.env.INITIAL_SUPPLY ?? "1000000000";
  const initialSupply = ethers.parseUnits(initialSupplyHuman, 18);

  console.log("Deploying VFXTToken");
  console.log("  network:       ", (await ethers.provider.getNetwork()).name);
  console.log("  deployer:      ", deployer.address);
  console.log("  treasury:      ", treasury);
  console.log("  initialSupply: ", initialSupplyHuman, "VFXT");

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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
