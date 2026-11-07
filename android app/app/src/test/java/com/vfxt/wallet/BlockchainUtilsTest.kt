package com.vfxt.wallet

import com.vfxt.wallet.blockchain.tokens.Erc20Abi
import com.vfxt.wallet.blockchain.transactions.TransactionService
import com.vfxt.wallet.core.common.QrCodes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.math.BigInteger

class BlockchainUtilsTest {
    private val addr = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94"

    @Test
    fun balanceOfCallDataIsSelectorPlusPaddedAddress() {
        assertEquals(
            "0x70a08231" + "000000000000000000000000" + "9858effd232b4033e47d90003d41ec34ecaeda94",
            Erc20Abi.balanceOf(addr),
        )
    }

    @Test
    fun transferCallDataEncodesAmount() {
        val data = Erc20Abi.transfer(addr, BigInteger("1000000000000000000"))
        assertEquals(2 + 8 + 64 + 64, data.length)
        assertEquals("0de0b6b3a7640000".padStart(64, '0'), data.takeLast(64))
    }

    @Test
    fun decodesUintAndEmptyResults() {
        assertEquals(BigInteger.valueOf(18), Erc20Abi.decodeUint("0x" + "12".padStart(64, '0')))
        assertNull(Erc20Abi.decodeUint("0x"))
    }

    @Test
    fun decodesAbiStringAndLegacyBytes32() {
        // ABI-encoded "USDT" (offset 32, length 4).
        val abi = "0x" + "20".padStart(64, '0') + "4".padStart(64, '0') + "55534454".padEnd(64, '0')
        assertEquals("USDT", Erc20Abi.decodeString(abi))
        // bytes32 "MKR"
        assertEquals("MKR", Erc20Abi.decodeString("0x" + "4d4b52".padEnd(64, '0')))
    }

    @Test
    fun stripsControlCharactersFromTokenMetadata() {
        val evil = "0x" + "20".padStart(64, '0') + "5".padStart(64, '0') + "55530a4454".padEnd(64, '0') // "US\nDT"
        assertEquals("USDT", Erc20Abi.decodeString(evil))
    }

    @Test
    fun extractsAddressFromQrPayloads() {
        assertEquals(addr, QrCodes.extractAddress(addr))
        assertEquals(addr, QrCodes.extractAddress("ethereum:$addr@56?value=1e18"))
        assertNull(QrCodes.extractAddress("https://example.com"))
        assertNull(QrCodes.extractAddress("0x1234"))
    }

    @Test
    fun extractsRecipientFromEip681TokenTransferNotContract() {
        val token = "0x4A08EF10e6f4aa077A74496793467d2192061969"
        val to = "0x76b16F59Cfab5DdaE5D149BE98E5d755F939572A"
        val uri = "ethereum:$token@56/transfer?address=$to&uint256=1000000000000000000"
        assertEquals(to, QrCodes.extractAddress(uri))
        val payment = QrCodes.extractPayment(uri)!!
        assertEquals(to, payment.recipient)
        assertEquals(token, payment.tokenAddress)
    }

    @Test
    fun parsesAmountsExactly() {
        assertEquals(BigInteger("1500000000000000000"), TransactionService.parseAmount("1.5", 18))
        assertEquals(BigInteger("1"), TransactionService.parseAmount("0.000000000000000001", 18))
        assertEquals(BigInteger("1234500"), TransactionService.parseAmount("1.2345", 6))
        // More precision than the token supports is rejected, not silently rounded.
        assertNull(TransactionService.parseAmount("1.0000001", 6))
        assertNull(TransactionService.parseAmount("-1", 18))
        assertNull(TransactionService.parseAmount("abc", 18))
    }
}
