package com.vfxt.wallet.blockchain.tokens

import java.math.BigInteger

/**
 * Hand-rolled ABI encoding for the handful of BEP-20 calls the wallet needs. Kept tiny and
 * unit-tested instead of pulling in a full ABI codegen stack.
 */
object Erc20Abi {
    // First 4 bytes of keccak256 of each function signature.
    private const val BALANCE_OF = "70a08231" // balanceOf(address)
    private const val TRANSFER = "a9059cbb" // transfer(address,uint256)
    private const val APPROVE = "095ea7b3" // approve(address,uint256)
    private const val ALLOWANCE = "dd62ed3e" // allowance(address,address)
    const val DECIMALS = "0x313ce567" // decimals()
    const val SYMBOL = "0x95d89b41" // symbol()
    const val NAME = "0x06fdde03" // name()

    fun balanceOf(owner: String): String = "0x$BALANCE_OF${encodeAddress(owner)}"

    fun transfer(to: String, amount: BigInteger): String {
        require(amount.signum() >= 0) { "Negative amount" }
        return "0x$TRANSFER${encodeAddress(to)}${encodeUint(amount)}"
    }

    /** Grants [spender] permission to move exactly [amount] of the caller's tokens. */
    fun approve(spender: String, amount: BigInteger): String {
        require(amount.signum() >= 0) { "Negative amount" }
        return "0x$APPROVE${encodeAddress(spender)}${encodeUint(amount)}"
    }

    fun allowance(owner: String, spender: String): String = "0x$ALLOWANCE${encodeAddress(owner)}${encodeAddress(spender)}"

    fun encodeAddress(address: String): String {
        val hex = address.removePrefix("0x").removePrefix("0X").lowercase()
        require(hex.length == 40 && hex.all { it in '0'..'9' || it in 'a'..'f' }) { "Invalid address" }
        return hex.padStart(64, '0')
    }

    fun encodeUint(value: BigInteger): String {
        val hex = value.toString(16)
        require(hex.length <= 64) { "Value exceeds uint256" }
        return hex.padStart(64, '0')
    }

    /** Decodes a single uint256 return value. Returns null for empty results (no contract / reverted). */
    fun decodeUint(result: String?): BigInteger? {
        val hex = result?.removePrefix("0x").orEmpty()
        if (hex.isEmpty()) return null
        return BigInteger(hex.take(64), 16)
    }

    /**
     * Decodes a `string` return value. Also accepts legacy tokens that return `bytes32` for
     * symbol/name. Non-printable characters are stripped so spoofed metadata can't inject
     * control characters into the UI.
     */
    fun decodeString(result: String?): String? {
        val hex = result?.removePrefix("0x").orEmpty()
        if (hex.isEmpty()) return null
        val raw: ByteArray = if (hex.length >= 128 && BigInteger(hex.take(64), 16) == BigInteger.valueOf(32)) {
            val length = BigInteger(hex.substring(64, 128), 16).toInt()
            if (length < 0 || hex.length < 128 + length * 2) return null
            hexToBytes(hex.substring(128, 128 + length * 2))
        } else {
            hexToBytes(hex.take(64)).takeWhile { it != 0.toByte() }.toByteArray()
        }
        return raw.decodeToString()
            .filter { !it.isISOControl() }
            .trim()
            .take(64)
            .ifEmpty { null }
    }

    private fun hexToBytes(hex: String): ByteArray =
        ByteArray(hex.length / 2) { i -> hex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
}
