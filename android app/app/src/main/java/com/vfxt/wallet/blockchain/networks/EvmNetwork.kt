package com.vfxt.wallet.blockchain.networks

/**
 * Static description of an EVM network. RPC endpoints are intentionally not part of this
 * model: they are injected from build/remote configuration in Phase 3 so that no provider
 * API keys are compiled into the app.
 */
data class EvmNetwork(
    val id: String,
    val name: String,
    val shortName: String,
    val chainId: Long,
    val nativeSymbol: String,
    val nativeDecimals: Int,
    val isTestnet: Boolean,
    val explorerBaseUrl: String,
) {
    fun explorerTxUrl(txHash: String) = "$explorerBaseUrl/tx/$txHash"
    fun explorerAddressUrl(address: String) = "$explorerBaseUrl/address/$address"
}

object Networks {
    val BscMainnet = EvmNetwork(
        id = "bsc-mainnet",
        name = "BNB Smart Chain",
        shortName = "BSC",
        chainId = 56,
        nativeSymbol = "BNB",
        nativeDecimals = 18,
        isTestnet = false,
        explorerBaseUrl = "https://bscscan.com",
    )

    val BscTestnet = EvmNetwork(
        id = "bsc-testnet",
        name = "BNB Smart Chain Testnet",
        shortName = "BSC Testnet",
        chainId = 97,
        nativeSymbol = "tBNB",
        nativeDecimals = 18,
        isTestnet = true,
        explorerBaseUrl = "https://testnet.bscscan.com",
    )

    // Ethereum and Polygon are added here once their token configuration is verified.
    val all: List<EvmNetwork> = listOf(BscMainnet, BscTestnet)

    fun byChainId(chainId: Long): EvmNetwork? = all.firstOrNull { it.chainId == chainId }
}
