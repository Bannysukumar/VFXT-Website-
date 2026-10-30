import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { VFXTToken } from "../typechain-types";

describe("VFXTToken", function () {
  const INITIAL_SUPPLY = ethers.parseUnits("1000000000", 18); // 1B VFXT

  let token: VFXTToken;
  let deployer: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  beforeEach(async function () {
    [deployer, treasury, alice, bob] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("VFXTToken");
    token = await factory.deploy(INITIAL_SUPPLY, treasury.address);
    await token.waitForDeployment();
  });

  describe("metadata", function () {
    it("has the correct name", async function () {
      expect(await token.name()).to.equal("Virtual FX Trades");
    });

    it("has the correct symbol", async function () {
      expect(await token.symbol()).to.equal("VFXT");
    });

    it("has 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });
  });

  describe("supply & minting policy", function () {
    it("mints the full initial supply to the treasury", async function () {
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await token.balanceOf(treasury.address)).to.equal(INITIAL_SUPPLY);
      expect(await token.balanceOf(deployer.address)).to.equal(0n);
    });

    it("rejects a zero treasury address at construction", async function () {
      const factory = await ethers.getContractFactory("VFXTToken");
      await expect(
        factory.deploy(INITIAL_SUPPLY, ethers.ZeroAddress)
      ).to.be.revertedWith("VFXT: treasury is zero address");
    });

    it("has no public mint function (fixed supply)", async function () {
      // Fixed-supply design: only constructor mint exists. Runtime mint would be a method
      // named `mint` — ensure the ABI does not expose one.
      const fragment = token.interface.getFunction("mint");
      expect(fragment).to.equal(null);
    });
  });

  describe("transfers", function () {
    beforeEach(async function () {
      await token.connect(treasury).transfer(alice.address, ethers.parseUnits("1000", 18));
    });

    it("transfers tokens between accounts", async function () {
      const amount = ethers.parseUnits("250", 18);
      await expect(token.connect(alice).transfer(bob.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(alice.address, bob.address, amount);

      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseUnits("750", 18));
      expect(await token.balanceOf(bob.address)).to.equal(amount);
    });

    it("reverts when sender has insufficient balance", async function () {
      const tooMuch = ethers.parseUnits("1001", 18);
      await expect(
        token.connect(alice).transfer(bob.address, tooMuch)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("rejects transfer to the zero address", async function () {
      await expect(
        token.connect(alice).transfer(ethers.ZeroAddress, 1n)
      ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
    });
  });

  describe("allowances", function () {
    const allowanceAmount = ethers.parseUnits("500", 18);

    beforeEach(async function () {
      await token.connect(treasury).transfer(alice.address, ethers.parseUnits("1000", 18));
    });

    it("approves and reads allowance", async function () {
      await expect(token.connect(alice).approve(bob.address, allowanceAmount))
        .to.emit(token, "Approval")
        .withArgs(alice.address, bob.address, allowanceAmount);

      expect(await token.allowance(alice.address, bob.address)).to.equal(allowanceAmount);
    });

    it("transferFrom spends allowance and moves tokens", async function () {
      const spend = ethers.parseUnits("200", 18);
      await token.connect(alice).approve(bob.address, allowanceAmount);

      await expect(token.connect(bob).transferFrom(alice.address, bob.address, spend))
        .to.emit(token, "Transfer")
        .withArgs(alice.address, bob.address, spend);

      expect(await token.balanceOf(bob.address)).to.equal(spend);
      expect(await token.allowance(alice.address, bob.address)).to.equal(
        allowanceAmount - spend
      );
    });

    it("reverts transferFrom when allowance is insufficient", async function () {
      await token.connect(alice).approve(bob.address, ethers.parseUnits("10", 18));
      await expect(
        token
          .connect(bob)
          .transferFrom(alice.address, bob.address, ethers.parseUnits("11", 18))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("rejects approve of the zero spender", async function () {
      await expect(
        token.connect(alice).approve(ethers.ZeroAddress, 1n)
      ).to.be.revertedWithCustomError(token, "ERC20InvalidSpender");
    });
  });
});
