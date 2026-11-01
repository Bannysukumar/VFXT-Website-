import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { MockERC20, VFXTSwap } from "../typechain-types";

const e18 = (v: string) => ethers.parseUnits(v, 18);

describe("VFXTSwap", function () {
  // 0.002 USDT per VFXT to buy, 0.0018 USDT per VFXT when selling back.
  const BUY_PRICE = e18("0.002");
  const SELL_PRICE = e18("0.0018");

  let vfxt: MockERC20;
  let usdt: MockERC20;
  let swap: VFXTSwap;
  let admin: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let manager: HardhatEthersSigner;
  let deadline: bigint;

  beforeEach(async function () {
    [admin, alice, bob, manager] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    vfxt = await Token.deploy("VFXT", "VFXT", 18);
    usdt = await Token.deploy("Tether USD", "USDT", 18);

    const Swap = await ethers.getContractFactory("VFXTSwap");
    swap = await Swap.deploy(await vfxt.getAddress(), await usdt.getAddress(), admin.address, BUY_PRICE, SELL_PRICE);

    // Admin funds the desk.
    await vfxt.mint(admin.address, e18("10000000"));
    await usdt.mint(admin.address, e18("10000"));
    await vfxt.connect(admin).approve(await swap.getAddress(), ethers.MaxUint256);
    await usdt.connect(admin).approve(await swap.getAddress(), ethers.MaxUint256);
    await swap.connect(admin).deposit(await vfxt.getAddress(), e18("1000000"));
    await swap.connect(admin).deposit(await usdt.getAddress(), e18("1000"));

    // Alice has USDT and VFXT to trade.
    await usdt.mint(alice.address, e18("100"));
    await vfxt.mint(alice.address, e18("50000"));
    await usdt.connect(alice).approve(await swap.getAddress(), ethers.MaxUint256);
    await vfxt.connect(alice).approve(await swap.getAddress(), ethers.MaxUint256);

    deadline = BigInt(await time.latest()) + 600n;
  });

  describe("deployment", function () {
    it("stores tokens, admin and prices", async function () {
      expect(await swap.vfxt()).to.equal(await vfxt.getAddress());
      expect(await swap.usdt()).to.equal(await usdt.getAddress());
      expect(await swap.owner()).to.equal(admin.address);
      expect(await swap.buyPrice()).to.equal(BUY_PRICE);
      expect(await swap.sellPrice()).to.equal(SELL_PRICE);
    });

    it("rejects zero addresses, identical tokens and sell > buy", async function () {
      const Swap = await ethers.getContractFactory("VFXTSwap");
      const v = await vfxt.getAddress();
      const u = await usdt.getAddress();
      await expect(Swap.deploy(ethers.ZeroAddress, u, admin.address, BUY_PRICE, SELL_PRICE)).to.be.revertedWithCustomError(swap, "ZeroAddress");
      await expect(Swap.deploy(v, v, admin.address, BUY_PRICE, SELL_PRICE)).to.be.revertedWithCustomError(swap, "SameToken");
      await expect(Swap.deploy(v, u, admin.address, SELL_PRICE, BUY_PRICE)).to.be.revertedWithCustomError(swap, "InvalidPrices");
    });
  });

  describe("buy", function () {
    it("gives VFXT at the buy price", async function () {
      // 10 USDT / 0.002 = 5000 VFXT
      expect(await swap.quoteBuy(e18("10"))).to.equal(e18("5000"));
      await expect(swap.connect(alice).buy(e18("10"), e18("5000"), deadline))
        .to.emit(swap, "Bought")
        .withArgs(alice.address, e18("10"), e18("5000"), BUY_PRICE);
      expect(await vfxt.balanceOf(alice.address)).to.equal(e18("55000"));
      expect(await usdt.balanceOf(alice.address)).to.equal(e18("90"));
      const [vfxtRes, usdtRes] = await swap.reserves();
      expect(vfxtRes).to.equal(e18("995000"));
      expect(usdtRes).to.equal(e18("1010"));
    });

    it("protects the user if the price rises before the trade is mined", async function () {
      await swap.connect(admin).setPrices(e18("0.004"), SELL_PRICE);
      await expect(swap.connect(alice).buy(e18("10"), e18("5000"), deadline))
        .to.be.revertedWithCustomError(swap, "Slippage")
        .withArgs(e18("2500"), e18("5000"));
    });

    it("reverts after the deadline", async function () {
      await time.increaseTo(deadline + 1n);
      await expect(swap.connect(alice).buy(e18("10"), 0, deadline)).to.be.revertedWithCustomError(swap, "Expired");
    });

    it("reverts when the contract lacks VFXT", async function () {
      await swap.connect(admin).withdrawAll(await vfxt.getAddress(), admin.address);
      await expect(swap.connect(alice).buy(e18("10"), 0, deadline)).to.be.revertedWithCustomError(swap, "InsufficientLiquidity");
    });

    it("is disabled when the buy price is 0", async function () {
      await swap.connect(admin).setPrices(0, SELL_PRICE);
      await expect(swap.connect(alice).buy(e18("10"), 0, deadline)).to.be.revertedWithCustomError(swap, "TradingDisabled");
    });
  });

  describe("sell", function () {
    it("gives USDT at the sell price", async function () {
      // 10,000 VFXT * 0.0018 = 18 USDT
      expect(await swap.quoteSell(e18("10000"))).to.equal(e18("18"));
      await expect(swap.connect(alice).sell(e18("10000"), e18("18"), deadline))
        .to.emit(swap, "Sold")
        .withArgs(alice.address, e18("10000"), e18("18"), SELL_PRICE);
      expect(await usdt.balanceOf(alice.address)).to.equal(e18("118"));
      expect(await vfxt.balanceOf(alice.address)).to.equal(e18("40000"));
    });

    it("protects the user if the price drops before the trade is mined", async function () {
      await swap.connect(admin).setPrices(BUY_PRICE, e18("0.001"));
      await expect(swap.connect(alice).sell(e18("10000"), e18("18"), deadline)).to.be.revertedWithCustomError(swap, "Slippage");
    });

    it("reverts when the contract lacks USDT", async function () {
      await swap.connect(admin).withdrawAll(await usdt.getAddress(), admin.address);
      await expect(swap.connect(alice).sell(e18("10000"), 0, deadline)).to.be.revertedWithCustomError(swap, "InsufficientLiquidity");
    });

    it("can't be used to profit by round-tripping", async function () {
      const before = await usdt.balanceOf(alice.address);
      await swap.connect(alice).buy(e18("10"), 0, deadline);
      await swap.connect(alice).sell(e18("5000"), 0, deadline);
      expect(await usdt.balanceOf(alice.address)).to.be.lessThan(before);
    });
  });

  describe("prices (admin panel)", function () {
    it("admin updates prices and emits the change", async function () {
      await expect(swap.connect(admin).setPrices(e18("0.003"), e18("0.0025")))
        .to.emit(swap, "PricesUpdated")
        .withArgs(BUY_PRICE, SELL_PRICE, e18("0.003"), e18("0.0025"), admin.address);
      expect(await swap.buyPrice()).to.equal(e18("0.003"));
      expect(await swap.sellPrice()).to.equal(e18("0.0025"));
    });

    it("rejects a sell price above the buy price", async function () {
      await expect(swap.connect(admin).setPrices(e18("0.002"), e18("0.003"))).to.be.revertedWithCustomError(swap, "InvalidPrices");
    });

    it("only admin or the price manager can set prices", async function () {
      await expect(swap.connect(alice).setPrices(1, 1)).to.be.revertedWithCustomError(swap, "NotPriceAdmin");
      await swap.connect(admin).setPriceManager(manager.address);
      await swap.connect(manager).setPrices(e18("0.005"), e18("0.004"));
      expect(await swap.buyPrice()).to.equal(e18("0.005"));
    });

    it("price manager cannot move funds", async function () {
      await swap.connect(admin).setPriceManager(manager.address);
      await expect(swap.connect(manager).withdraw(await usdt.getAddress(), manager.address, 1))
        .to.be.revertedWithCustomError(swap, "OwnableUnauthorizedAccount");
    });
  });

  describe("liquidity (admin panel)", function () {
    it("admin deposits VFXT and USDT", async function () {
      await expect(swap.connect(admin).deposit(await usdt.getAddress(), e18("50")))
        .to.emit(swap, "Deposited")
        .withArgs(await usdt.getAddress(), admin.address, e18("50"));
      const [, usdtRes] = await swap.reserves();
      expect(usdtRes).to.equal(e18("1050"));
    });

    it("rejects deposits of other tokens and by non-admins", async function () {
      const Token = await ethers.getContractFactory("MockERC20");
      const other = await Token.deploy("Other", "OTH", 18);
      await expect(swap.connect(admin).deposit(await other.getAddress(), 1)).to.be.revertedWithCustomError(swap, "UnsupportedToken");
      await expect(swap.connect(alice).deposit(await usdt.getAddress(), 1)).to.be.revertedWithCustomError(swap, "OwnableUnauthorizedAccount");
    });

    it("admin withdraws to itself or to any other address", async function () {
      const u = await usdt.getAddress();
      await expect(swap.connect(admin).withdraw(u, admin.address, e18("100")))
        .to.emit(swap, "Withdrawn")
        .withArgs(u, admin.address, e18("100"));
      await swap.connect(admin).withdraw(u, bob.address, e18("200"));
      await swap.connect(admin).withdraw(await vfxt.getAddress(), bob.address, e18("1000"));
      expect(await usdt.balanceOf(bob.address)).to.equal(e18("200"));
      expect(await vfxt.balanceOf(bob.address)).to.equal(e18("1000"));
      const [vfxtRes, usdtRes] = await swap.reserves();
      expect(vfxtRes).to.equal(e18("999000"));
      expect(usdtRes).to.equal(e18("700"));
    });

    it("recovers other tokens sent by mistake", async function () {
      const Token = await ethers.getContractFactory("MockERC20");
      const other = await Token.deploy("Other", "OTH", 18);
      await other.mint(await swap.getAddress(), e18("5"));
      await swap.connect(admin).withdrawAll(await other.getAddress(), bob.address);
      expect(await other.balanceOf(bob.address)).to.equal(e18("5"));
    });

    it("non-admins cannot withdraw", async function () {
      await expect(swap.connect(alice).withdraw(await usdt.getAddress(), alice.address, 1))
        .to.be.revertedWithCustomError(swap, "OwnableUnauthorizedAccount");
      await expect(swap.connect(alice).withdrawAll(await usdt.getAddress(), alice.address))
        .to.be.revertedWithCustomError(swap, "OwnableUnauthorizedAccount");
    });
  });

  describe("safety controls", function () {
    it("pause stops trading but not withdrawals", async function () {
      await swap.connect(admin).pause();
      await expect(swap.connect(alice).buy(e18("10"), 0, deadline)).to.be.revertedWithCustomError(swap, "EnforcedPause");
      await expect(swap.connect(alice).sell(e18("10"), 0, deadline)).to.be.revertedWithCustomError(swap, "EnforcedPause");
      await swap.connect(admin).withdraw(await usdt.getAddress(), admin.address, e18("1"));
      await swap.connect(admin).unpause();
      await swap.connect(alice).buy(e18("10"), 0, deadline);
    });

    it("enforces per-trade USDT limits", async function () {
      await swap.connect(admin).setTradeLimits(e18("5"), e18("50"));
      await expect(swap.connect(alice).buy(e18("1"), 0, deadline)).to.be.revertedWithCustomError(swap, "TradeTooSmall");
      await expect(swap.connect(alice).buy(e18("60"), 0, deadline)).to.be.revertedWithCustomError(swap, "TradeTooLarge");
      await swap.connect(alice).buy(e18("10"), 0, deadline);
      await expect(swap.connect(admin).setTradeLimits(e18("50"), e18("5"))).to.be.revertedWithCustomError(swap, "InvalidLimits");
    });

    it("ownership transfer is two-step and renounce is disabled", async function () {
      await swap.connect(admin).transferOwnership(bob.address);
      expect(await swap.owner()).to.equal(admin.address);
      await swap.connect(bob).acceptOwnership();
      expect(await swap.owner()).to.equal(bob.address);
      await expect(swap.connect(bob).renounceOwnership()).to.be.revertedWith("VFXTSwap: renounce disabled");
    });

    it("handles tokens with different decimals", async function () {
      const Token = await ethers.getContractFactory("MockERC20");
      const usdt6 = await Token.deploy("USD 6dp", "USD6", 6);
      const Swap = await ethers.getContractFactory("VFXTSwap");
      const s = await Swap.deploy(await vfxt.getAddress(), await usdt6.getAddress(), admin.address, BUY_PRICE, SELL_PRICE);
      // 10 USDT (6 decimals) at 0.002 => 5000 VFXT (18 decimals)
      expect(await s.quoteBuy(10_000_000n)).to.equal(e18("5000"));
      expect(await s.quoteSell(e18("10000"))).to.equal(18_000_000n);
    });
  });
});
