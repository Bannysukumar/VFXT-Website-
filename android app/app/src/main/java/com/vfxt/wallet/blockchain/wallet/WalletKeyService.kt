package com.vfxt.wallet.blockchain.wallet

import org.web3j.crypto.Bip32ECKeyPair
import org.web3j.crypto.Keys
import org.web3j.crypto.MnemonicUtils
import org.web3j.crypto.Sign
import org.web3j.utils.Numeric
import java.math.BigInteger
import java.security.SecureRandom
import javax.inject.Inject
import javax.inject.Singleton

/** A derived account. [privateKey] is secret: never log it, persist it unencrypted, or send it anywhere. */
class DerivedAccount(
    val address: String,
    val privateKey: BigInteger,
)

/**
 * Key management built entirely on web3j's audited crypto primitives:
 *  - BIP-39 mnemonic generation / checksum validation / seed derivation (PBKDF2-HMAC-SHA512)
 *  - BIP-32 hierarchical derivation on secp256k1
 *  - EIP-55 checksummed addresses
 *
 * Derivation path: m/44'/60'/0'/0/{index}, the default used by MetaMask, Trust Wallet, Ledger Live
 * (Ethereum app, "BIP44 standard") and most EVM wallets. The same phrase + index therefore yields
 * the same address across those wallets. Wallets using a different scheme (e.g. Ledger Legacy
 * m/44'/60'/0'/{index}) are not covered.
 *
 * No passphrase ("25th word") is applied, matching MetaMask and Trust Wallet defaults.
 */
@Singleton
class WalletKeyService @Inject constructor() {

    private val secureRandom = SecureRandom()

    /** Generates a new BIP-39 mnemonic from fresh CSPRNG entropy (128 bits → 12 words, 256 bits → 24). */
    fun generateMnemonic(wordCount: Int): String {
        val entropyBytes = when (wordCount) {
            12 -> 16
            24 -> 32
            else -> throw IllegalArgumentException("Only 12 or 24 words are supported")
        }
        val entropy = ByteArray(entropyBytes)
        try {
            secureRandom.nextBytes(entropy)
            return MnemonicUtils.generateMnemonic(entropy)
        } finally {
            entropy.fill(0)
        }
    }

    /** Lower-cases and collapses whitespace so pasted phrases validate consistently. */
    fun normalizeMnemonic(input: String): String =
        input.trim().lowercase().split(WHITESPACE).filter { it.isNotEmpty() }.joinToString(" ")

    /** Full BIP-39 validation: word count, every word in the English list, and the checksum. */
    fun isValidMnemonic(input: String): Boolean {
        val normalized = normalizeMnemonic(input)
        val count = normalized.split(" ").size
        if (count != 12 && count != 24) return false
        return runCatching { MnemonicUtils.validateMnemonic(normalized) }.getOrDefault(false)
    }

    /**
     * True for widely published BIP-39 test vectors whose private keys are public
     * (e.g. "abandon … about"). These must never hold real funds.
     */
    fun isKnownInsecureMnemonic(input: String): Boolean =
        normalizeMnemonic(input) in KNOWN_INSECURE_MNEMONICS

    fun deriveFromMnemonic(mnemonic: String, accountIndex: Int): DerivedAccount {
        require(accountIndex in 0 until MAX_ACCOUNT_INDEX) { "Account index out of range" }
        val normalized = normalizeMnemonic(mnemonic)
        require(!isKnownInsecureMnemonic(normalized)) {
            "This recovery phrase is a public test phrase. Its private key is known — do not use it for real funds."
        }
        val seed = MnemonicUtils.generateSeed(normalized, "")
        try {
            val master = Bip32ECKeyPair.generateKeyPair(seed)
            val path = intArrayOf(
                44 or Bip32ECKeyPair.HARDENED_BIT,
                60 or Bip32ECKeyPair.HARDENED_BIT,
                0 or Bip32ECKeyPair.HARDENED_BIT,
                0,
                accountIndex,
            )
            val child = Bip32ECKeyPair.deriveKeyPair(master, path)
            return DerivedAccount(addressOf(child.publicKey), child.privateKey)
        } finally {
            seed.fill(0)
        }
    }

    /** Accepts 64 hex chars with or without 0x and rejects keys outside the secp256k1 range [1, n-1]. */
    fun parsePrivateKey(input: String): BigInteger? {
        val hex = input.trim().removePrefix("0x").removePrefix("0X")
        if (!PRIVATE_KEY_HEX.matches(hex)) return null
        val key = BigInteger(hex, 16)
        if (key.signum() <= 0 || key >= SECP256K1_N) return null
        // Reject the well-known private key for the abandon…about test vector.
        if (key in KNOWN_INSECURE_PRIVATE_KEYS) return null
        return key
    }

    fun deriveFromPrivateKey(privateKey: BigInteger): DerivedAccount =
        DerivedAccount(addressOf(Sign.publicKeyFromPrivate(privateKey)), privateKey)

    fun privateKeyHex(privateKey: BigInteger): String = Numeric.toHexStringWithPrefixZeroPadded(privateKey, 64)

    /**
     * EIP-191 personal_sign over [message] UTF-8 bytes. Returns 0x-prefixed 65-byte signature.
     * Used only for wallet ownership proofs (Firebase login); never for sending funds.
     */
    fun signPersonalMessage(privateKey: BigInteger, message: String): String {
        val keyPair = org.web3j.crypto.ECKeyPair.create(privateKey)
        val signature = Sign.signPrefixedMessage(message.toByteArray(Charsets.UTF_8), keyPair)
        val r = Numeric.toBytesPadded(Numeric.toBigInt(signature.r), 32)
        val s = Numeric.toBytesPadded(Numeric.toBigInt(signature.s), 32)
        val v = signature.v
        val out = ByteArray(65)
        System.arraycopy(r, 0, out, 0, 32)
        System.arraycopy(s, 0, out, 32, 32)
        out[64] = if (v.size == 1) v[0] else v.last()
        return Numeric.toHexString(out)
    }

    private fun addressOf(publicKey: BigInteger): String = Keys.toChecksumAddress(Keys.getAddress(publicKey))

    companion object {
        const val DERIVATION_PATH_PREFIX = "m/44'/60'/0'/0/"
        const val MAX_ACCOUNT_INDEX = 100
        private val WHITESPACE = Regex("\\s+")
        private val PRIVATE_KEY_HEX = Regex("^[0-9a-fA-F]{64}$")

        /** Order of the secp256k1 group. */
        private val SECP256K1_N = BigInteger("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", 16)

        private val KNOWN_INSECURE_MNEMONICS = setOf(
            "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
            "test test test test test test test test test test test junk",
        )

        private val KNOWN_INSECURE_PRIVATE_KEYS = setOf(
            // Private key for abandon…about → 0x9858EfFD232B4033E47d90003D41EC34EcaEda94
            BigInteger("1ab42cc412b618bdea3a599e3c9bae199ebf030895b039e9db1e30dafb12b727", 16),
        )

        private val ADDRESS = Regex("^0x[0-9a-fA-F]{40}$")

        /** Structural check plus EIP-55 checksum verification for mixed-case addresses. */
        fun isValidAddress(address: String): Boolean {
            if (!ADDRESS.matches(address)) return false
            val body = address.substring(2)
            val mixedCase = body.any { it.isUpperCase() } && body.any { it.isLowerCase() }
            return !mixedCase || Keys.toChecksumAddress(address) == address
        }
    }
}
