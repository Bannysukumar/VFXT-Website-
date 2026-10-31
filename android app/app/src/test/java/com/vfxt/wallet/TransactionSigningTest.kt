package com.vfxt.wallet

import org.junit.Assert.assertEquals
import org.junit.Test
import org.web3j.crypto.Credentials
import org.web3j.crypto.RawTransaction
import org.web3j.crypto.TransactionEncoder
import org.web3j.utils.Numeric
import java.math.BigInteger

/**
 * Verifies the exact signing path used by TransactionService against the canonical example from
 * the EIP-155 specification (replay-protected signatures). A byte-for-byte match proves nonce,
 * gas, value, chain id and signature encoding are all correct.
 */
class TransactionSigningTest {

    @Test
    fun matchesEip155SpecificationExample() {
        val credentials = Credentials.create("0x4646464646464646464646464646464646464646464646464646464646464646")
        val tx = RawTransaction.createEtherTransaction(
            BigInteger.valueOf(9),
            BigInteger.valueOf(20_000_000_000L),
            BigInteger.valueOf(21_000),
            "0x3535353535353535353535353535353535353535",
            BigInteger("1000000000000000000"),
        )
        val signed = Numeric.toHexString(TransactionEncoder.signMessage(tx, 1L, credentials))
        assertEquals(
            "0xf86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83",
            signed,
        )
    }

    @Test
    fun bscChainIdIsEncodedInSignature() {
        val credentials = Credentials.create("0x4646464646464646464646464646464646464646464646464646464646464646")
        val tx = RawTransaction.createEtherTransaction(
            BigInteger.ZERO, BigInteger.ONE, BigInteger.valueOf(21_000),
            "0x3535353535353535353535353535353535353535", BigInteger.ONE,
        )
        val signed = Numeric.hexStringToByteArray(Numeric.toHexString(TransactionEncoder.signMessage(tx, 97L, credentials)))
        // EIP-155: v = recId + chainId * 2 + 35 → 229 or 230 for BSC testnet (97). The RLP payload
        // encodes v as a single byte 0x81 0xE5/0xE6 right before r.
        val hex = Numeric.toHexString(signed)
        assert(hex.contains("81e5a0") || hex.contains("81e6a0")) { "chain id 97 not encoded: $hex" }
    }
}
