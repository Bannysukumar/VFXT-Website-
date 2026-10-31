package com.vfxt.wallet.blockchain.networks

/**
 * Description of an EVM network (built-in or user-added).
 *
 * [rpcUrls] are public, key-less endpoints tried in order with automatic failover. Every endpoint
 * is checked against [chainId] before use, so a misconfigured or malicious endpoint for another
 * chain is rejected rather than trusted.
 */
data class EvmNetwork(
    val id: String,
    val name: String,
    val shortName: String,
    val chainId: Long,
    val nativeSymbol: String,
    val nativeName: String,
    val nativeDecimals: Int,
    val isTestnet: Boolean,
    val explorerBaseUrl: String,
    val rpcUrls: List<String>,
    /** CoinGecko id for the native coin's fiat price; null when no reliable market quote exists. */
    val nativePriceId: String?,
    /** CoinGecko asset-platform id for contract-based price lookups (e.g. "ethereum"). */
    val coingeckoPlatform: String? = null,
    val isCustom: Boolean = false,
) {
    fun explorerTxUrl(txHash: String) = "$explorerBaseUrl/tx/$txHash"
    fun explorerAddressUrl(address: String) = "$explorerBaseUrl/address/$address"
    fun explorerTokenUrl(contract: String) = "$explorerBaseUrl/token/$contract"
}

object Networks {
    val BscMainnet = EvmNetwork(
        id = "bsc-mainnet",
        name = "BNB Smart Chain",
        shortName = "BSC",
        chainId = 56,
        nativeSymbol = "BNB",
        nativeName = "BNB",
        nativeDecimals = 18,
        isTestnet = false,
        explorerBaseUrl = "https://bscscan.com",
        rpcUrls = listOf(
            "https://bsc-dataseed.bnbchain.org",
            "https://bsc-dataseed1.binance.org",
            "https://bsc-rpc.publicnode.com",
        ),
        nativePriceId = "binancecoin",
        coingeckoPlatform = "binance-smart-chain",
    )

    val BscTestnet = EvmNetwork(
        id = "bsc-testnet",
        name = "BNB Smart Chain Testnet",
        shortName = "BSC Testnet",
        chainId = 97,
        nativeSymbol = "tBNB",
        nativeName = "Test BNB",
        nativeDecimals = 18,
        isTestnet = true,
        explorerBaseUrl = "https://testnet.bscscan.com",
        rpcUrls = listOf(
            "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
            "https://data-seed-prebsc-2-s1.bnbchain.org:8545",
            "https://bsc-testnet-rpc.publicnode.com",
        ),
        nativePriceId = "binancecoin",
        coingeckoPlatform = null,
    )

    val Ethereum = EvmNetwork(
        id = "ethereum",
        name = "Ethereum",
        shortName = "ETH",
        chainId = 1,
        nativeSymbol = "ETH",
        nativeName = "Ether",
        nativeDecimals = 18,
        isTestnet = false,
        explorerBaseUrl = "https://etherscan.io",
        rpcUrls = listOf(
            "https://ethereum.publicnode.com",
            "https://rpc.ankr.com/eth",
            "https://cloudflare-eth.com",
        ),
        nativePriceId = "ethereum",
        coingeckoPlatform = "ethereum",
    )

    val Polygon = EvmNetwork(
        id = "polygon",
        name = "Polygon",
        shortName = "Polygon",
        chainId = 137,
        nativeSymbol = "POL",
        nativeName = "POL",
        nativeDecimals = 18,
        isTestnet = false,
        explorerBaseUrl = "https://polygonscan.com",
        rpcUrls = listOf(
            "https://polygon-bor.publicnode.com",
            "https://polygon-rpc.com",
            "https://rpc.ankr.com/polygon",
        ),
        nativePriceId = "matic-network",
        coingeckoPlatform = "polygon-pos",
    )

    val Arbitrum = EvmNetwork(
        id = "arbitrum",
        name = "Arbitrum One",
        shortName = "Arbitrum",
        chainId = 42161,
        nativeSymbol = "ETH",
        nativeName = "Ether",
        nativeDecimals = 18,
        isTestnet = false,
        explorerBaseUrl = "https://arbiscan.io",
        rpcUrls = listOf(
            "https://arbitrum-one.publicnode.com",
            "https://arb1.arbitrum.io/rpc",
            "https://rpc.ankr.com/arbitrum",
        ),
        nativePriceId = "ethereum",
        coingeckoPlatform = "arbitrum-one",
    )

    val Optimism = EvmNetwork(
        id = "optimism",
        name = "Optimism",
        shortName = "Optimism",
        chainId = 10,
        nativeSymbol = "ETH",
        nativeName = "Ether",
        nativeDecimals = 18,
        isTestnet = false,
        explorerBaseUrl = "https://optimistic.etherscan.io",
        rpcUrls = listOf(
            "https://optimism.publicnode.com",
            "https://mainnet.optimism.io",
            "https://rpc.ankr.com/optimism",
        ),
        nativePriceId = "ethereum",
        coingeckoPlatform = "optimistic-ethereum",
    )

    val Base = EvmNetwork(
        id = "base",
        name = "Base",
        shortName = "Base",
        chainId = 8453,
        nativeSymbol = "ETH",
        nativeName = "Ether",
        nativeDecimals = 18,
        isTestnet = false,
        explorerBaseUrl = "https://basescan.org",
        rpcUrls = listOf(
            "https://base.publicnode.com",
            "https://mainnet.base.org",
            "https://rpc.ankr.com/base",
        ),
        nativePriceId = "ethereum",
        coingeckoPlatform = "base",
    )

    val Avalanche = EvmNetwork(
        id = "avalanche",
        name = "Avalanche C-Chain",
        shortName = "Avalanche",
        chainId = 43114,
        nativeSymbol = "AVAX",
        nativeName = "Avalanche",
        nativeDecimals = 18,
        isTestnet = false,
        explorerBaseUrl = "https://snowtrace.io",
        rpcUrls = listOf(
            "https://avalanche-c-chain.publicnode.com",
            "https://api.avax.network/ext/bc/C/rpc",
            "https://rpc.ankr.com/avalanche",
        ),
        nativePriceId = "avalanche-2",
        coingeckoPlatform = "avalanche",
    )

    val Sepolia = EvmNetwork(
        id = "sepolia",
        name = "Ethereum Sepolia",
        shortName = "Sepolia",
        chainId = 11155111,
        nativeSymbol = "ETH",
        nativeName = "Sepolia ETH",
        nativeDecimals = 18,
        isTestnet = true,
        explorerBaseUrl = "https://sepolia.etherscan.io",
        rpcUrls = listOf(
            "https://ethereum-sepolia.publicnode.com",
            "https://rpc.sepolia.org",
        ),
        nativePriceId = "ethereum",
        coingeckoPlatform = null,
    )

    /** Built-in networks shown on the Network page (mainnets first, then testnets). */
    val all: List<EvmNetwork> = listOf(
        BscMainnet,
        Ethereum,
        Polygon,
        Arbitrum,
        Optimism,
        Base,
        Avalanche,
        BscTestnet,
        Sepolia,
    )

    fun byId(id: String): EvmNetwork? = all.firstOrNull { it.id == id }

    fun byChainId(chainId: Long): EvmNetwork? = all.firstOrNull { it.chainId == chainId }
}
