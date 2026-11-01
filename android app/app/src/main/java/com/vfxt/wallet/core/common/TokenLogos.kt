package com.vfxt.wallet.core.common

import org.web3j.crypto.Keys

/**
 * Logo URLs for networks and tokens.
 *
 * Primary source is Trust Wallet's open-source asset repository, keyed by chain + EIP-55 contract
 * address. Because the key is the contract address (not the symbol), a fake token reusing a famous
 * name never gets the real token's logo.
 *
 * Only images from [ALLOWED_HOSTS] are ever loaded; anything else falls back to the locally drawn
 * glyph. Arbitrary image URLs from token lists can be used to track users or to make scam tokens
 * look legitimate.
 */
object TokenLogos {
    private const val TW = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains"

    /** chainId → Trust Wallet blockchain folder. Testnets reuse their mainnet artwork. */
    private val CHAIN_SLUG = mapOf(
        56L to "smartchain", 97L to "smartchain",
        1L to "ethereum", 11155111L to "ethereum",
        137L to "polygon",
        42161L to "arbitrum",
        10L to "optimism",
        8453L to "base",
        43114L to "avalanchec",
    )

    private val NETWORK_ID_TO_CHAIN = mapOf(
        "bsc-mainnet" to 56L, "bsc-testnet" to 97L,
        "ethereum" to 1L, "sepolia" to 11155111L,
        "polygon" to 137L, "arbitrum" to 42161L, "optimism" to 10L, "base" to 8453L, "avalanche" to 43114L,
    )

    private val ALLOWED_HOSTS = setOf(
        "raw.githubusercontent.com",
        "assets.coingecko.com",
        "coin-images.coingecko.com",
        "static.debank.com",
        "s2.coinmarketcap.com",
    )

    fun chainIdFor(networkId: String): Long? = NETWORK_ID_TO_CHAIN[networkId]

    /** Native coin / network logo, or null for chains without verified artwork (custom networks). */
    fun network(chainId: Long): String? = CHAIN_SLUG[chainId]?.let { "$TW/$it/info/logo.png" }

    /** Token logo for a contract on [chainId]; native coin when [contract] is null. */
    fun token(chainId: Long, contract: String?): String? {
        val slug = CHAIN_SLUG[chainId] ?: return null
        if (contract == null || contract.equals(ZERO_ADDRESS, ignoreCase = true)) return network(chainId)
        val checksum = runCatching { Keys.toChecksumAddress(contract) }.getOrNull() ?: return null
        return "$TW/$slug/assets/$checksum/logo.png"
    }

    fun token(networkId: String, contract: String?): String? = chainIdFor(networkId)?.let { token(it, contract) }

    /** Returns [url] only if it is HTTPS on a trusted host. */
    fun trusted(url: String?): String? {
        if (url.isNullOrBlank()) return null
        val parsed = runCatching { java.net.URI(url) }.getOrNull() ?: return null
        return url.takeIf { parsed.scheme == "https" && parsed.host?.lowercase() in ALLOWED_HOSTS }
    }

    private const val ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
}
