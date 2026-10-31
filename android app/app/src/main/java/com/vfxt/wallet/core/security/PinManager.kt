package com.vfxt.wallet.core.security

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.min

sealed interface PinCheck {
    data object Success : PinCheck
    data class Wrong(val attemptsBeforeLockout: Int) : PinCheck
    data class LockedOut(val untilMillis: Long) : PinCheck
}

@Serializable
private data class PinRecord(
    val salt: String,
    val hash: String,
    val iterations: Int,
    val failedAttempts: Int = 0,
    val lockedUntil: Long = 0,
)

/**
 * App PIN. Stored as PBKDF2-HMAC-SHA256(pin, 16-byte random salt) inside the Keystore-encrypted
 * secure store; the PIN itself is never persisted. Repeated failures trigger an exponential
 * lockout that survives app restarts.
 */
@Singleton
class PinManager @Inject constructor(private val store: SecureFileStore) {

    private val mutex = Mutex()
    private val json = Json { ignoreUnknownKeys = true }
    private val random = SecureRandom()

    private val _isPinSet = MutableStateFlow<Boolean?>(null)
    val isPinSet: StateFlow<Boolean?> = _isPinSet.asStateFlow()

    suspend fun load() = mutex.withLock { _isPinSet.value = read() != null }

    suspend fun setPin(pin: CharArray) = mutex.withLock {
        require(pin.size == PIN_LENGTH && pin.all { it in '0'..'9' }) { "PIN must be $PIN_LENGTH digits" }
        val salt = ByteArray(16).also(random::nextBytes)
        val hash = derive(pin, salt, ITERATIONS)
        write(PinRecord(b64(salt), b64(hash), ITERATIONS))
        hash.fill(0)
        _isPinSet.value = true
    }

    suspend fun verify(pin: CharArray): PinCheck = mutex.withLock {
        val record = read() ?: return@withLock PinCheck.Wrong(MAX_ATTEMPTS)
        val now = System.currentTimeMillis()
        if (record.lockedUntil > now) return@withLock PinCheck.LockedOut(record.lockedUntil)

        val candidate = derive(pin, unb64(record.salt), record.iterations)
        val matches = MessageDigest.isEqual(candidate, unb64(record.hash))
        candidate.fill(0)

        if (matches) {
            if (record.failedAttempts != 0) write(record.copy(failedAttempts = 0, lockedUntil = 0))
            PinCheck.Success
        } else {
            val failures = record.failedAttempts + 1
            if (failures >= MAX_ATTEMPTS) {
                // 30s, 60s, 120s ... capped at one hour.
                val penalty = min(BASE_LOCKOUT_MS shl (failures - MAX_ATTEMPTS), MAX_LOCKOUT_MS)
                val until = now + penalty
                write(record.copy(failedAttempts = failures, lockedUntil = until))
                PinCheck.LockedOut(until)
            } else {
                write(record.copy(failedAttempts = failures))
                PinCheck.Wrong(MAX_ATTEMPTS - failures)
            }
        }
    }

    private suspend fun derive(pin: CharArray, salt: ByteArray, iterations: Int): ByteArray =
        withContext(Dispatchers.Default) {
            val spec = PBEKeySpec(pin, salt, iterations, 256)
            try {
                SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
            } finally {
                spec.clearPassword()
            }
        }

    private suspend fun read(): PinRecord? = withContext(Dispatchers.IO) {
        store.read(FILE)?.let { json.decodeFromString(PinRecord.serializer(), it.decodeToString()) }
    }

    private suspend fun write(record: PinRecord) = withContext(Dispatchers.IO) {
        store.write(FILE, json.encodeToString(PinRecord.serializer(), record).encodeToByteArray())
    }

    private fun b64(bytes: ByteArray) = Base64.getEncoder().encodeToString(bytes)
    private fun unb64(text: String) = Base64.getDecoder().decode(text)

    companion object {
        const val PIN_LENGTH = 6
        const val MAX_ATTEMPTS = 5
        private const val FILE = "app_pin"
        private const val ITERATIONS = 120_000
        private const val BASE_LOCKOUT_MS = 30_000L
        private const val MAX_LOCKOUT_MS = 3_600_000L
    }
}
