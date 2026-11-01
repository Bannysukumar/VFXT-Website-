package com.vfxt.wallet

import com.vfxt.wallet.blockchain.swap.VfxtDeskService
import com.vfxt.wallet.blockchain.tokens.TokenRegistry
import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger

class VfxtDeskTest {

    @Test
    fun contractAddressesAreChecksummedAndConsistent() {
        assertTrue(WalletKeyService.isValidAddress(VfxtDeskService.VFXT_SWAP))
        assertTrue(WalletKeyService.isValidAddress(VfxtDeskService.USDT))
        assertEquals(TokenRegistry.VFXT_BSC_MAINNET, VfxtDeskService.VFXT)
    }

    @Test
    fun displaysEighteenDecimalAmounts() {
        assertEquals("0.0001", VfxtDeskService.display(BigInteger("100000000000000")))
        assertEquals("10000", VfxtDeskService.display(BigInteger("10000000000000000000000")))
    }

    @Test
    fun mapsContractErrorsToPlainLanguage() {
        assertTrue(VfxtDeskService.friendlyRevert("execution reverted: 0xa17e11d5000...").contains("liquidity"))
        assertTrue(VfxtDeskService.friendlyRevert("execution reverted 0x2746152a...").contains("price changed"))
        assertTrue(VfxtDeskService.friendlyRevert("0xd93c0665").contains("paused"))
        assertTrue(VfxtDeskService.friendlyRevert("insufficient funds for gas").contains("BNB"))
    }
}
