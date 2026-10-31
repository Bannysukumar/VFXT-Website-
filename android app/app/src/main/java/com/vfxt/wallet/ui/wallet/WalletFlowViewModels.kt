package com.vfxt.wallet.ui.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import com.vfxt.wallet.core.security.PinManager
import com.vfxt.wallet.data.local.DuplicateWalletException
import com.vfxt.wallet.data.local.WalletVault
import com.vfxt.wallet.data.repository.WalletCreationSession
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject
import kotlin.random.Random

/** Where to go after a wallet has been stored. */
enum class WalletAddedNext { PinSetup, Home }

@HiltViewModel
class CreateWalletViewModel @Inject constructor(
    private val session: WalletCreationSession,
) : ViewModel() {
    /** Generates the phrase off the main thread; the CSPRNG and BIP-39 checksum are cheap but not free. */
    fun generate(wordCount: Int, onReady: () -> Unit) {
        viewModelScope.launch {
            withContext(Dispatchers.Default) { session.start(wordCount) }
            onReady()
        }
    }

    fun discard() = session.clear()
}

@HiltViewModel
class RecoveryPhraseViewModel @Inject constructor(
    session: WalletCreationSession,
) : ViewModel() {
    /** Null if the process was recreated and the in-memory phrase is gone. */
    val words: List<String>? = session.pendingWords
}

data class VerifyChallenge(val index: Int, val options: List<String>, val answer: String)

data class VerifyUiState(
    val challenges: List<VerifyChallenge> = emptyList(),
    val selections: Map<Int, String> = emptyMap(),
    val saving: Boolean = false,
    val error: String? = null,
    val sessionLost: Boolean = false,
) {
    val allCorrect: Boolean get() = challenges.isNotEmpty() && challenges.all { selections[it.index] == it.answer }
}

@HiltViewModel
class VerifyPhraseViewModel @Inject constructor(
    private val session: WalletCreationSession,
    private val vault: WalletVault,
    private val pinManager: PinManager,
) : ViewModel() {

    private val _state = MutableStateFlow(VerifyUiState())
    val state: StateFlow<VerifyUiState> = _state.asStateFlow()

    private val _added = Channel<WalletAddedNext>(Channel.BUFFERED)
    val added: Flow<WalletAddedNext> = _added.receiveAsFlow()

    init {
        val words = session.pendingWords
        if (words == null) {
            _state.value = VerifyUiState(sessionLost = true)
        } else {
            // Three distinct positions, each with the right word plus two other words from the phrase.
            val positions = words.indices.shuffled().take(3).sorted()
            _state.value = VerifyUiState(
                challenges = positions.map { i ->
                    val decoys = words.filterIndexed { j, w -> j != i && w != words[i] }.distinct().shuffled().take(2)
                    VerifyChallenge(i, (decoys + words[i]).shuffled(Random(System.nanoTime())), words[i])
                },
            )
        }
    }

    fun select(index: Int, word: String) = _state.update {
        it.copy(selections = it.selections + (index to word), error = null)
    }

    fun confirm() {
        val s = _state.value
        if (!s.allCorrect || s.saving) {
            _state.update { it.copy(error = "One or more words are incorrect. Check your written phrase.") }
            return
        }
        _state.update { it.copy(saving = true) }
        viewModelScope.launch {
            val mnemonic = session.consume()
            if (mnemonic == null) {
                _state.update { it.copy(saving = false, sessionLost = true) }
                return@launch
            }
            runCatching { vault.addMnemonicWallet(name = "", mnemonic = mnemonic, accountIndex = 0, created = true) }
                .onSuccess { _added.send(if (pinManager.isPinSet.value == true) WalletAddedNext.Home else WalletAddedNext.PinSetup) }
                .onFailure { e ->
                    _state.update {
                        it.copy(
                            saving = false,
                            error = if (e is DuplicateWalletException) "This wallet already exists as \"${e.existingName}\"." else "Couldn't save the wallet. Please try again.",
                        )
                    }
                }
        }
    }
}

data class ImportUiState(
    val previewAddress: String? = null,
    val phraseValid: Boolean = false,
    val keyValid: Boolean = false,
    val deriving: Boolean = false,
    val saving: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ImportWalletViewModel @Inject constructor(
    private val keys: WalletKeyService,
    private val vault: WalletVault,
    private val pinManager: PinManager,
) : ViewModel() {

    private val _state = MutableStateFlow(ImportUiState())
    val state: StateFlow<ImportUiState> = _state.asStateFlow()

    private val _added = Channel<WalletAddedNext>(Channel.BUFFERED)
    val added: Flow<WalletAddedNext> = _added.receiveAsFlow()

    private var previewJob: Job? = null

    /**
     * Validates input and derives the address so the user can confirm it matches their other
     * wallet before importing. The secret is only used transiently here; only the address is kept.
     */
    fun onInputChanged(isPhrase: Boolean, input: String, accountIndex: Int) {
        previewJob?.cancel()
        _state.update { it.copy(error = null) }
        previewJob = viewModelScope.launch {
            delay(250) // debounce typing
            val result = withContext(Dispatchers.Default) {
                if (isPhrase) {
                    if (!keys.isValidMnemonic(input)) null else keys.deriveFromMnemonic(input, accountIndex).address
                } else {
                    keys.parsePrivateKey(input)?.let { keys.deriveFromPrivateKey(it).address }
                }
            }
            _state.update {
                it.copy(
                    previewAddress = result,
                    phraseValid = isPhrase && result != null,
                    keyValid = !isPhrase && result != null,
                )
            }
        }
    }

    fun import(isPhrase: Boolean, input: String, accountIndex: Int) {
        if (_state.value.saving) return
        _state.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            runCatching {
                if (isPhrase) {
                    vault.addMnemonicWallet(name = "", mnemonic = input, accountIndex = accountIndex, created = false)
                } else {
                    vault.addPrivateKeyWallet(name = "", privateKeyInput = input)
                }
            }.onSuccess {
                _added.send(if (pinManager.isPinSet.value == true) WalletAddedNext.Home else WalletAddedNext.PinSetup)
            }.onFailure { e ->
                _state.update {
                    it.copy(
                        saving = false,
                        error = when (e) {
                            is DuplicateWalletException -> "This wallet is already imported as \"${e.existingName}\"."
                            is IllegalArgumentException -> e.message
                            else -> "Couldn't import the wallet. Please try again."
                        },
                    )
                }
            }
        }
    }
}
