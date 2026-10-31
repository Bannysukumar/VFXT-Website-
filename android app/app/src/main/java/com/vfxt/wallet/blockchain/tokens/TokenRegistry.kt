package com.vfxt.wallet.blockchain.tokens

import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.networks.Networks
import com.vfxt.wallet.domain.models.TokenInfo
import com.vfxt.wallet.domain.models.TokenKind

/**
 * Built-in token list, keyed by network. A token is only ever looked up together with its
 * network so a contract address from one chain can never be used on another.
 *
 * BEP-20 contract addresses are left null until they are verified on-chain and configured
 * in Phase 3. A null address means "balance cannot be read yet", never "use a default".
 */
object TokenRegistry {
    private fun nativeOf(network: EvmNetwork) = TokenInfo(
        symbol = network.nativeSymbol,
        name = if (network.isTestnet) "Test BNB" else "BNB",
        decimals = network.nativeDecimals,
        networkId = network.id,
        kind = TokenKind.Native,
        contractAddress = null,
    )

    private fun bep20(network: EvmNetwork, symbol: String, name: String, decimals: Int) = TokenInfo(
        symbol = symbol,
        name = name,
        decimals = decimals,
        networkId = network.id,
        kind = TokenKind.Bep20,
        contractAddress = null,
    )

    fun defaultTokens(network: EvmNetwork): List<TokenInfo> = listOf(
        nativeOf(network),
        bep20(network, "USDT", "Tether USD", 18),
        bep20(network, "VFXT", "VFXT Token", 18),
    )

    val defaultNetwork: EvmNetwork = Networks.BscMainnet
}
