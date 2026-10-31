package com.vfxt.wallet

import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger

/**
 * Interoperability vectors. These are public, widely published test values (never use them for
 * real funds). Matching them proves addresses agree with MetaMask / Trust Wallet / ethers.js.
 */
class WalletKeyServiceTest {
    private val service = WalletKeyService()

    private val testMnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

    @Test
    fun rejectsPublicTestMnemonicUsedAsRealWallet() {
        assertTrue(service.isKnownInsecureMnemonic(testMnemonic))
        assertTrue(
            runCatching { service.deriveFromMnemonic(testMnemonic, 0) }
                .exceptionOrNull() is IllegalArgumentException,
        )
    }

    @Test
    fun rejectsKnownInsecurePrivateKey() {
        assertNull(
            service.parsePrivateKey("0x1ab42cc412b618bdea3a599e3c9bae199ebf030895b039e9db1e30dafb12b727"),
        )
    }

    @Test
    fun differentAccountIndexYieldsDifferentAddress() {
        // Fresh random mnemonic — not a public test vector.
        val mnemonic = service.generateMnemonic(12)
        val first = service.deriveFromMnemonic(mnemonic, 0).address
        val second = service.deriveFromMnemonic(mnemonic, 1).address
        assertNotEquals(first, second)
    }

    @Test
    fun derivationIsDeterministicAndNormalizesInput() {
        val mnemonic = service.generateMnemonic(12)
        val messy = "  ${mnemonic.uppercase().replace(" ", "\n ")}  "
        assertEquals(
            service.deriveFromMnemonic(mnemonic, 0).address,
            service.deriveFromMnemonic(messy, 0).address,
        )
    }

    @Test
    fun privateKeyOneMapsToKnownAddress() {
        val key = service.parsePrivateKey("0x" + "0".repeat(63) + "1")!!
        assertEquals("0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf", service.deriveFromPrivateKey(key).address)
    }

    @Test
    fun rejectsOutOfRangePrivateKeys() {
        assertNull(service.parsePrivateKey("0".repeat(64)))
        assertNull(service.parsePrivateKey("F".repeat(64)))
        assertNull(service.parsePrivateKey("abc"))
    }

    @Test
    fun privateKeyHexIsZeroPadded() {
        assertEquals("0x" + "0".repeat(63) + "1", service.privateKeyHex(BigInteger.ONE))
    }

    @Test
    fun generatedMnemonicsAreValidAndUnique() {
        val twelve = service.generateMnemonic(12)
        val twentyFour = service.generateMnemonic(24)
        assertEquals(12, twelve.split(" ").size)
        assertEquals(24, twentyFour.split(" ").size)
        assertTrue(service.isValidMnemonic(twelve))
        assertTrue(service.isValidMnemonic(twentyFour))
        assertNotEquals(twelve, service.generateMnemonic(12))
    }

    @Test
    fun rejectsBadChecksumAndUnknownWords() {
        // Valid words, invalid checksum.
        assertFalse(service.isValidMnemonic(List(12) { "abandon" }.joinToString(" ")))
        assertFalse(service.isValidMnemonic(testMnemonic.replace("about", "notaword")))
        assertFalse(service.isValidMnemonic("abandon about"))
    }

    @Test
    fun addressValidationChecksEip55() {
        assertTrue(WalletKeyService.isValidAddress("0x9858EfFD232B4033E47d90003D41EC34EcaEda94"))
        assertTrue(WalletKeyService.isValidAddress("0x9858effd232b4033e47d90003d41ec34ecaeda94"))
        // One letter's case flipped breaks the checksum.
        assertFalse(WalletKeyService.isValidAddress("0x9858EfFD232B4033E47d90003D41EC34EcaEda9A"))
        assertFalse(WalletKeyService.isValidAddress("0x1234"))
    }
}
