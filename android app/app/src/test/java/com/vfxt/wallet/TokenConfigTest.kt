package com.vfxt.wallet

import com.vfxt.wallet.blockchain.tokens.TokenRegistry
import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import com.vfxt.wallet.core.common.TokenLogos
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TokenConfigTest {

    @Test
    fun vfxtMainnetAddressPassesChecksum() {
        // A wrong upper/lower-case pattern made the app treat VFXT as "not deployed".
        assertTrue(WalletKeyService.isValidAddress(TokenRegistry.VFXT_BSC_MAINNET))
        assertTrue(WalletKeyService.isValidAddress(TokenRegistry.VFXT_TREASURY))
    }

    @Test
    fun bscMainnetListsCurrentVfxtContract() {
        val vfxt = TokenRegistry.defaultTokens(com.vfxt.wallet.blockchain.networks.Networks.BscMainnet)
            .first { it.symbol == "VFXT" }
        assertEquals("0x4A08EF10e6f4aa077A74496793467d2192061969", vfxt.contractAddress)
        assertEquals(18, vfxt.decimals)
    }

    @Test
    fun logoUrlsUseChecksummedAddressAndKnownChains() {
        assertEquals(
            "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x55d398326f99059fF775485246999027B3197955/logo.png",
            TokenLogos.token(56, "0x55d398326f99059ff775485246999027b3197955"),
        )
        assertEquals(
            "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
            TokenLogos.token(137, null),
        )
        assertNull(TokenLogos.network(999_999))
    }

    @Test
    fun onlyTrustedHttpsHostsAreLoaded() {
        assertEquals("https://static.debank.com/a.png", TokenLogos.trusted("https://static.debank.com/a.png"))
        assertNull(TokenLogos.trusted("http://static.debank.com/a.png"))
        assertNull(TokenLogos.trusted("https://evil.example/logo.png"))
        assertNull(TokenLogos.trusted("https://static.debank.com.evil.example/x.png"))
        assertNull(TokenLogos.trusted(null))
    }
}
