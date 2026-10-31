package com.vfxt.wallet.data.repository

import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Holds a freshly generated recovery phrase in memory while the user moves through
 * Backup → Verify. It is deliberately not passed through navigation arguments or saved state,
 * so it never lands in the saved-instance-state bundle. If the process dies mid-flow the
 * phrase is gone and the user simply starts again; nothing was stored yet.
 */
@Singleton
class WalletCreationSession @Inject constructor(private val keys: WalletKeyService) {

    private var words: List<String>? = null

    val pendingWords: List<String>? get() = words

    fun start(wordCount: Int): List<String> =
        keys.generateMnemonic(wordCount).split(" ").also { words = it }

    /** Hands the phrase to the caller exactly once and forgets it. */
    fun consume(): String? = words?.joinToString(" ").also { clear() }

    fun clear() {
        words = null
    }
}
