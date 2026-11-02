package com.vfxt.wallet.blockchain.tokens

import com.vfxt.wallet.BuildConfig
import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.networks.Networks
import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import com.vfxt.wallet.domain.models.TokenInfo
import com.vfxt.wallet.domain.models.TokenKind

/**
 * Built-in token list, keyed by network. A token is only ever looked up together with its
 * network so a contract address from one chain can never be used on another.
 *
 * - Stablecoins use CoinGecko ids for live USD quotes.
 * - VFXT (BSC mainnet): [VFXT_BSC_MAINNET], overridable via `vfxt.tokenMainnet` /
 *   `vfxt.tokenTestnet` in local.properties for alternate deployments.
 */
object TokenRegistry {
    /**
     * VFXT BEP-20 on BSC mainnet. Verified on-chain: name/symbol VFXT, 18 decimals,
     * fixed 10,000,000,000,000 (10 trillion) supply minted to treasury, plain OpenZeppelin v5
     * ERC-20 (no owner, mint, pause, blacklist or fee functions). EIP-55 checksum required.
     */
    const val VFXT_BSC_MAINNET = "0x4A08EF10e6f4aa077A74496793467d2192061969"

    /** Treasury wallet that received the full VFXT supply at deployment. */
    const val VFXT_TREASURY = "0x76b16F59Cfab5DdaE5D149BE98E5d755F939572A"

    /** Retired first deployment (1B supply). Builds still configured with it use the current contract. */
    private const val VFXT_BSC_RETIRED = "0xB1F5170839CDaDE72109fA5C268dc043bF9bFbF4"
    private const val USDT_BSC = "0x55d398326f99059fF775485246999027B3197955"
    private const val USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
    private const val USDT_ETH = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    private const val USDC_ETH = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    private const val USDT_POLYGON = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"
    private const val USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"
    private const val USDT_ARBITRUM = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
    private const val USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
    private const val USDT_OPTIMISM = "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58"
    private const val USDC_OPTIMISM = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"
    private const val USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    private const val USDT_AVALANCHE = "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7"
    private const val USDC_AVALANCHE = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"

    private fun native(network: EvmNetwork) = TokenInfo(
        symbol = network.nativeSymbol,
        name = network.nativeName,
        decimals = network.nativeDecimals,
        networkId = network.id,
        kind = TokenKind.Native,
        contractAddress = null,
        priceId = network.nativePriceId,
    )

    private fun erc20(
        symbol: String,
        name: String,
        decimals: Int,
        network: EvmNetwork,
        contract: String,
        priceId: String?,
    ) = TokenInfo(symbol, name, decimals, network.id, TokenKind.Bep20, contract, priceId = priceId)

    private fun vfxt(network: EvmNetwork): TokenInfo? {
        // VFXT is a BNB Smart Chain project token; only list it on BSC nets.
        if (network.id != Networks.BscMainnet.id && network.id != Networks.BscTestnet.id) return null
        val fromBuild = if (network.isTestnet) BuildConfig.VFXT_TOKEN_TESTNET else BuildConfig.VFXT_TOKEN_MAINNET
        val fallback = if (network.isTestnet) "" else VFXT_BSC_MAINNET
        val configured = fromBuild.trim().takeIf { it.isNotBlank() }?.let { value ->
            // The current contract written with the wrong letter case (an invalid EIP-55 checksum),
            // or the retired first deployment: use the verified current address. Any *other*
            // address with a bad checksum is still rejected below, since the checksum catches typos.
            val known = value.equals(VFXT_BSC_MAINNET, ignoreCase = true) || value.equals(VFXT_BSC_RETIRED, ignoreCase = true)
            if (!network.isTestnet && known) VFXT_BSC_MAINNET else value
        } ?: fallback
        return TokenInfo(
            symbol = "VFXT",
            name = "VFXT",
            decimals = 18,
            networkId = network.id,
            kind = TokenKind.Bep20,
            contractAddress = configured.takeIf { WalletKeyService.isValidAddress(it) },
            priceId = null,
        )
    }

    fun defaultTokens(network: EvmNetwork): List<TokenInfo> {
        val builtIns = when (network.id) {
            Networks.BscMainnet.id -> listOf(
                native(network),
                erc20("USDT", "Tether USD", 18, network, USDT_BSC, "tether"),
                erc20("USDC", "USD Coin", 18, network, USDC_BSC, "usd-coin"),
            )
            Networks.BscTestnet.id -> listOf(native(network))
            Networks.Ethereum.id -> listOf(
                native(network),
                erc20("USDT", "Tether USD", 6, network, USDT_ETH, "tether"),
                erc20("USDC", "USD Coin", 6, network, USDC_ETH, "usd-coin"),
            )
            Networks.Polygon.id -> listOf(
                native(network),
                erc20("USDT", "Tether USD", 6, network, USDT_POLYGON, "tether"),
                erc20("USDC", "USD Coin", 6, network, USDC_POLYGON, "usd-coin"),
            )
            Networks.Arbitrum.id -> listOf(
                native(network),
                erc20("USDT", "Tether USD", 6, network, USDT_ARBITRUM, "tether"),
                erc20("USDC", "USD Coin", 6, network, USDC_ARBITRUM, "usd-coin"),
            )
            Networks.Optimism.id -> listOf(
                native(network),
                erc20("USDT", "Tether USD", 6, network, USDT_OPTIMISM, "tether"),
                erc20("USDC", "USD Coin", 6, network, USDC_OPTIMISM, "usd-coin"),
            )
            Networks.Base.id -> listOf(
                native(network),
                erc20("USDC", "USD Coin", 6, network, USDC_BASE, "usd-coin"),
            )
            Networks.Avalanche.id -> listOf(
                native(network),
                erc20("USDT", "Tether USD", 6, network, USDT_AVALANCHE, "tether"),
                erc20("USDC", "USD Coin", 6, network, USDC_AVALANCHE, "usd-coin"),
            )
            else -> listOf(native(network))
        }
        return builtIns + listOfNotNull(vfxt(network))
    }

    /** Network selected on first launch (and after removing the active custom network), in every build. */
    val defaultNetwork: EvmNetwork = Networks.BscMainnet
}
