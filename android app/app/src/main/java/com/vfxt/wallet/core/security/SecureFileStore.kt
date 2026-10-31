package com.vfxt.wallet.core.security

import android.content.Context
import android.util.AtomicFile
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.FileNotFoundException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Stores whole files encrypted with [KeystoreCipher] in `noBackupFilesDir`, which is excluded
 * from Auto Backup and device-to-device transfer. Writes are atomic so a crash mid-write cannot
 * corrupt the vault.
 */
@Singleton
class SecureFileStore @Inject constructor(
    @ApplicationContext context: Context,
    private val cipher: KeystoreCipher,
) {
    private val dir = File(context.noBackupFilesDir, "secure").apply { mkdirs() }

    private fun file(name: String) = AtomicFile(File(dir, "$name.bin"))

    @Synchronized
    fun read(name: String): ByteArray? {
        val f = file(name)
        val blob = try {
            f.readFully()
        } catch (_: FileNotFoundException) {
            return null
        }
        return cipher.decrypt(blob)
    }

    @Synchronized
    fun write(name: String, plaintext: ByteArray) {
        val encrypted = cipher.encrypt(plaintext)
        val f = file(name)
        val out = f.startWrite()
        try {
            out.write(encrypted)
            f.finishWrite(out)
        } catch (e: Exception) {
            f.failWrite(out)
            throw e
        }
    }

    @Synchronized
    fun delete(name: String) = file(name).delete()
}
