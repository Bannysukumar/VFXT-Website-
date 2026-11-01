package com.vfxt.wallet.blockchain.walletconnect

import android.app.Application
import android.util.Log
import com.reown.android.Core
import com.reown.android.CoreClient
import com.reown.android.relay.ConnectionType
import com.reown.walletkit.client.Wallet
import com.reown.walletkit.client.WalletKit
import com.vfxt.wallet.BuildConfig
import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.networks.Networks
import com.vfxt.wallet.blockchain.rpc.EvmRpc
import com.vfxt.wallet.blockchain.rpc.RpcException
import com.vfxt.wallet.blockchain.transactions.TransactionService
import com.vfxt.wallet.blockchain.transactions.TransferException
import com.vfxt.wallet.data.local.ChainStore
import com.vfxt.wallet.data.local.TxRecord
import com.vfxt.wallet.data.local.WalletSummary
import com.vfxt.wallet.data.local.WalletVault
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.web3j.crypto.Credentials
import org.web3j.crypto.Sign
import org.web3j.crypto.StructuredDataEncoder
import org.web3j.utils.Numeric
import java.math.BigDecimal
import java.math.BigInteger
import javax.inject.Inject
import javax.inject.Singleton

data class WcSessionSummary(
    val topic: String,
    val peerName: String,
    val peerUrl: String?,
    val peerIcon: String?,
    val chains: List<String>,
)

sealed interface WcConnectionState {
    data object Disabled : WcConnectionState
    data object Idle : WcConnectionState
    data class Connected(val sessions: List<WcSessionSummary>) : WcConnectionState
}

/** How much to trust the dApp's domain, from Reown's Verify API. */
enum class WcTrust { Verified, Unknown, Mismatch, Scam }

data class WcProposal(
    val proposerPublicKey: String,
    val name: String,
    val url: String,
    val icon: String?,
    val chains: List<String>,
    val unsupportedChains: List<String>,
    val trust: WcTrust,
    internal val raw: Wallet.Model.SessionProposal,
)

sealed interface WcRequestDetail {
    data class SignMessage(val message: String) : WcRequestDetail
    data class SignTypedData(val domain: String?, val primaryType: String?, val json: String) : WcRequestDetail
    data class SendTransaction(
        val to: String?,
        val valueDisplay: String,
        val hasData: Boolean,
        val dataPreview: String?,
    ) : WcRequestDetail
}

data class WcRequest(
    val id: Long,
    val topic: String,
    val method: String,
    val peerName: String,
    val peerUrl: String?,
    val peerIcon: String?,
    val network: EvmNetwork,
    val account: String,
    val detail: WcRequestDetail,
    val trust: WcTrust,
    internal val params: String,
)

/**
 * WalletConnect v2 wallet side, on Reown WalletKit.
 *
 * The SDK only carries encrypted messages between the dApp and this app. Every connection and
 * every signing request is shown to the user and needs explicit approval (plus PIN/biometrics for
 * signing); nothing is ever approved automatically. Keys are decrypted only inside [approveRequest].
 */
@Singleton
class WalletConnectSessionManager @Inject constructor(
    private val vault: WalletVault,
    private val transactions: TransactionService,
    private val rpc: EvmRpc,
    private val chainStore: ChainStore,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true }

    @Volatile private var initialized = false

    private val _state = MutableStateFlow<WcConnectionState>(
        if (isConfigured()) WcConnectionState.Idle else WcConnectionState.Disabled,
    )
    val state: StateFlow<WcConnectionState> = _state.asStateFlow()

    private val _proposal = MutableStateFlow<WcProposal?>(null)
    val proposal: StateFlow<WcProposal?> = _proposal.asStateFlow()

    /** Pending signing requests, oldest first. The UI shows the head of the queue. */
    private val _requests = MutableStateFlow<List<WcRequest>>(emptyList())
    val requests: StateFlow<List<WcRequest>> = _requests.asStateFlow()

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    fun isConfigured(): Boolean = BuildConfig.WALLETCONNECT_PROJECT_ID.isNotBlank()

    fun clearMessage() {
        _message.value = null
    }

    /** Called once from Application.onCreate. */
    fun initialize(application: Application) {
        if (!isConfigured() || initialized) return
        try {
            val metaData = Core.Model.AppMetaData(
                name = "VFXT Wallet",
                description = "Self-custody wallet for BNB Smart Chain and EVM networks",
                url = "https://virtualfxtrades.com",
                icons = listOf("https://virtualfxtrades.com/favicon.ico"),
                redirect = "vfxtwallet://request",
            )
            CoreClient.initialize(
                application = application,
                projectId = BuildConfig.WALLETCONNECT_PROJECT_ID,
                metaData = metaData,
                connectionType = ConnectionType.AUTOMATIC,
                onError = { Log.w(TAG, "Core init error", it.throwable) },
            )
            WalletKit.initialize(
                Wallet.Params.Init(core = CoreClient),
                onSuccess = {
                    initialized = true
                    refreshSessions()
                },
                onError = { Log.w(TAG, "WalletKit init error", it.throwable) },
            )
            WalletKit.setWalletDelegate(delegate)
        } catch (e: Exception) {
            Log.w(TAG, "WalletConnect unavailable", e)
        }
    }

    /** Accepts a `wc:` URI from the QR scanner or a deep link. */
    fun submitPairingUri(uri: String): Result<Unit> {
        val trimmed = uri.trim()
        if (!trimmed.startsWith("wc:", ignoreCase = true)) {
            return Result.failure(IllegalArgumentException("That QR code isn't a WalletConnect link."))
        }
        if (!isConfigured()) {
            return Result.failure(IllegalStateException("WalletConnect isn't configured in this build."))
        }
        if (vault.wallets.value.isNullOrEmpty()) {
            return Result.failure(IllegalStateException("Create or import a wallet first."))
        }
        // A v2 URI looks like wc:topic@2?relay-protocol=irn&symKey=...
        if (!trimmed.contains("@2")) {
            return Result.failure(IllegalArgumentException("This dApp uses an old WalletConnect version that is no longer supported."))
        }
        return runCatching {
            WalletKit.pair(
                Wallet.Params.Pair(trimmed),
                onSuccess = { _message.value = "Connecting… approve the request when it appears." },
                onError = { _message.value = "Couldn't connect: ${it.throwable.message ?: "pairing failed"}" },
            )
        }
    }

    // --- Proposals ----------------------------------------------------------------------------

    fun approveProposal() {
        val p = _proposal.value ?: return
        val wallet = activeWallet()
        if (wallet == null) {
            rejectProposal("No wallet available")
            return
        }
        val chains = Networks.all.map { "eip155:${it.chainId}" }
        val supported = mapOf(
            "eip155" to Wallet.Model.Namespace.Session(
                chains = chains,
                accounts = chains.map { "$it:${wallet.address}" },
                methods = SUPPORTED_METHODS,
                events = SUPPORTED_EVENTS,
            ),
        )
        _busy.value = true
        try {
            val approved = WalletKit.generateApprovedNamespaces(p.raw, supported)
            WalletKit.approveSession(
                Wallet.Params.SessionApprove(proposerPublicKey = p.proposerPublicKey, namespaces = approved),
                onSuccess = {
                    _busy.value = false
                    _proposal.value = null
                    _message.value = "Connected to ${p.name}."
                    refreshSessions()
                },
                onError = {
                    _busy.value = false
                    _proposal.value = null
                    _message.value = "Connection failed: ${it.throwable.message ?: "unknown error"}"
                },
            )
        } catch (e: Exception) {
            _busy.value = false
            rejectProposal("Unsupported networks or methods")
            _message.value = "${p.name} asked for networks or features VFXT Wallet doesn't support."
        }
    }

    fun rejectProposal(reason: String = "User rejected") {
        val p = _proposal.value ?: return
        _proposal.value = null
        runCatching {
            WalletKit.rejectSession(Wallet.Params.SessionReject(p.proposerPublicKey, reason), onSuccess = {}, onError = {})
        }
    }

    // --- Requests -----------------------------------------------------------------------------

    /** Signs (and for transactions, broadcasts) the head request. Call only after PIN/biometrics. */
    fun approveRequest(request: WcRequest) {
        _busy.value = true
        scope.launch {
            val response: Wallet.Model.JsonRpcResponse = try {
                val result = execute(request)
                Wallet.Model.JsonRpcResponse.JsonRpcResult(request.id, result)
            } catch (e: Exception) {
                _message.value = e.message ?: "Request failed"
                Wallet.Model.JsonRpcResponse.JsonRpcError(request.id, -32000, e.message ?: "Request failed")
            }
            respond(request, response)
            _busy.value = false
        }
    }

    fun rejectRequest(request: WcRequest) {
        respond(request, Wallet.Model.JsonRpcResponse.JsonRpcError(request.id, USER_REJECTED, "User rejected the request"))
    }

    fun disconnect(topic: String) {
        runCatching {
            WalletKit.disconnectSession(
                Wallet.Params.SessionDisconnect(topic),
                onSuccess = { refreshSessions() },
                onError = { refreshSessions() },
            )
        }
    }

    fun disconnectAll() {
        sessionsOrEmpty().forEach { disconnect(it.topic) }
    }

    private fun respond(request: WcRequest, response: Wallet.Model.JsonRpcResponse) {
        _requests.update { list -> list.filterNot { it.id == request.id } }
        runCatching {
            WalletKit.respondSessionRequest(
                Wallet.Params.SessionRequestResponse(request.topic, response),
                onSuccess = {},
                onError = { Log.w(TAG, "respond failed", it.throwable) },
            )
        }
    }

    private suspend fun execute(request: WcRequest): String {
        val wallet = activeWallet() ?: throw IllegalStateException("No wallet available")
        if (!wallet.address.equals(request.account, ignoreCase = true)) {
            throw IllegalStateException("Switch to wallet ${request.account.take(6)}…${request.account.takeLast(4)} to sign this request.")
        }
        val params = json.parseToJsonElement(request.params) as? JsonArray
            ?: throw IllegalArgumentException("Malformed request")
        return when (request.method) {
            "personal_sign" -> {
                val bytes = messageBytes(params.string(0))
                sign(wallet) { Sign.signPrefixedMessage(bytes, it) }
            }
            "eth_signTypedData", "eth_signTypedData_v4" -> {
                val typed = typedDataJson(params)
                val hash = StructuredDataEncoder(typed).hashStructuredData()
                sign(wallet) { Sign.signMessage(hash, it, false) }
            }
            "eth_sendTransaction" -> sendTransaction(request, wallet, params[0].jsonObject)
            else -> throw IllegalArgumentException("Unsupported method ${request.method}")
        }
    }

    private suspend fun sign(wallet: WalletSummary, block: (org.web3j.crypto.ECKeyPair) -> Sign.SignatureData): String =
        withContext(Dispatchers.Default) {
            val credentials = Credentials.create(vault.revealPrivateKey(wallet.id))
            check(credentials.address.equals(wallet.address, ignoreCase = true)) { "Key does not match wallet" }
            val sig = block(credentials.ecKeyPair)
            Numeric.toHexString(sig.r + sig.s + sig.v)
        }

    private suspend fun sendTransaction(request: WcRequest, wallet: WalletSummary, tx: JsonObject): String {
        val network = request.network
        val to = tx.str("to") ?: throw TransferException("Contract creation from dApps isn't supported.")
        val value = tx.str("value")?.let(Numeric::toBigInt) ?: BigInteger.ZERO
        val data = tx.str("data") ?: tx.str("input")
        val dataOrNull = data?.takeIf { it.length > 2 }
        val gasPrice = tx.str("gasPrice")?.let(Numeric::toBigInt) ?: rpc.gasPrice(network)
        val gasLimit = tx.str("gas")?.let(Numeric::toBigInt) ?: try {
            rpc.estimateGas(network, wallet.address, to, value, dataOrNull) * BigInteger.valueOf(12) / BigInteger.TEN
        } catch (e: RpcException) {
            throw TransferException("This transaction would fail: ${e.message}")
        }
        val hash = transactions.signAndBroadcast(network, wallet.id, wallet.address, to, value, dataOrNull, gasLimit, gasPrice)
        chainStore.upsertTransaction(
            TxRecord(
                hash = hash,
                networkId = network.id,
                from = wallet.address,
                to = to,
                tokenSymbol = network.nativeSymbol,
                amount = BigDecimal(value).movePointLeft(network.nativeDecimals).stripTrailingZeros().toPlainString(),
                status = TransactionService.STATUS_PENDING,
                timestamp = System.currentTimeMillis(),
                fee = BigDecimal(gasLimit * gasPrice).movePointLeft(network.nativeDecimals).stripTrailingZeros().toPlainString(),
                kind = if (dataOrNull != null) TxRecord.KIND_APPROVE.takeIf { dataOrNull.startsWith(APPROVE_SELECTOR) } ?: TxRecord.KIND_TRANSFER else TxRecord.KIND_TRANSFER,
            ),
        )
        scope.launch { transactions.awaitReceipt(network, hash) }
        return hash
    }

    // --- Delegate -----------------------------------------------------------------------------

    private val delegate = object : WalletKit.WalletDelegate {
        override fun onSessionProposal(sessionProposal: Wallet.Model.SessionProposal, verifyContext: Wallet.Model.VerifyContext) {
            val requested = (sessionProposal.requiredNamespaces.values + sessionProposal.optionalNamespaces.values)
                .flatMap { it.chains.orEmpty() }
                .distinct()
            val required = sessionProposal.requiredNamespaces.values.flatMap { it.chains.orEmpty() }
            val supported = Networks.all.map { "eip155:${it.chainId}" }.toSet()
            _proposal.value = WcProposal(
                proposerPublicKey = sessionProposal.proposerPublicKey,
                name = sessionProposal.name.ifBlank { "Unknown dApp" },
                url = sessionProposal.url,
                icon = sessionProposal.icons.firstOrNull()?.toString(),
                chains = requested.mapNotNull { chainLabel(it) },
                unsupportedChains = required.filterNot { it in supported },
                trust = trust(verifyContext),
                raw = sessionProposal,
            )
        }

        override fun onSessionRequest(sessionRequest: Wallet.Model.SessionRequest, verifyContext: Wallet.Model.VerifyContext) {
            val req = sessionRequest.request
            val reject = { code: Int, msg: String ->
                runCatching {
                    WalletKit.respondSessionRequest(
                        Wallet.Params.SessionRequestResponse(sessionRequest.topic, Wallet.Model.JsonRpcResponse.JsonRpcError(req.id, code, msg)),
                        onSuccess = {}, onError = {},
                    )
                }
            }
            if (req.method !in SUPPORTED_METHODS) {
                reject(UNSUPPORTED_METHOD, "Method ${req.method} is not supported by VFXT Wallet")
                return
            }
            val chainId = sessionRequest.chainId?.substringAfter("eip155:")?.toLongOrNull()
            val network = chainId?.let(Networks::byChainId)
            if (network == null) {
                reject(UNSUPPORTED_CHAIN, "Chain ${sessionRequest.chainId} is not supported")
                return
            }
            val parsed = runCatching { parseRequest(req.method, req.params) }.getOrNull()
            if (parsed == null) {
                reject(INVALID_PARAMS, "Invalid request parameters")
                return
            }
            val (account, detail) = parsed
            val peer = sessionRequest.peerMetaData
            _requests.update {
                it + WcRequest(
                    id = req.id,
                    topic = sessionRequest.topic,
                    method = req.method,
                    peerName = peer?.name?.ifBlank { null } ?: "dApp",
                    peerUrl = peer?.url,
                    peerIcon = peer?.icons?.firstOrNull(),
                    network = network,
                    account = account,
                    detail = detail.withNetwork(network),
                    trust = trust(verifyContext),
                    params = req.params,
                )
            }
        }

        override fun onSessionDelete(sessionDelete: Wallet.Model.SessionDelete) = refreshSessions()
        override fun onSessionExtend(session: Wallet.Model.Session) = refreshSessions()
        override fun onSessionSettleResponse(settleSessionResponse: Wallet.Model.SettledSessionResponse) = refreshSessions()
        override fun onSessionUpdateResponse(sessionUpdateResponse: Wallet.Model.SessionUpdateResponse) = refreshSessions()

        override fun onProposalExpired(proposal: Wallet.Model.ExpiredProposal) {
            if (_proposal.value?.proposerPublicKey == proposal.proposerPublicKey) {
                _proposal.value = null
                _message.value = "The connection request expired. Scan the QR code again."
            }
        }

        override fun onRequestExpired(request: Wallet.Model.ExpiredRequest) {
            _requests.update { list -> list.filterNot { it.id == request.id } }
        }

        override fun onConnectionStateChange(state: Wallet.Model.ConnectionState) = Unit

        override fun onError(error: Wallet.Model.Error) {
            Log.w(TAG, "WalletKit error", error.throwable)
        }
    }

    // --- Helpers ------------------------------------------------------------------------------

    private fun parseRequest(method: String, params: String): Pair<String, WcRequestDetail> {
        val arr = json.parseToJsonElement(params) as JsonArray
        return when (method) {
            "personal_sign" -> {
                val raw = arr.string(0)
                val account = arr.string(1)
                account to WcRequestDetail.SignMessage(displayMessage(raw))
            }
            "eth_signTypedData", "eth_signTypedData_v4" -> {
                val account = arr.string(0)
                val typed = typedDataJson(arr)
                val obj = json.parseToJsonElement(typed).jsonObject
                val domain = (obj["domain"] as? JsonObject)?.str("name")
                account to WcRequestDetail.SignTypedData(domain, obj.str("primaryType"), typed)
            }
            "eth_sendTransaction" -> {
                val tx = arr[0].jsonObject
                val account = tx.str("from") ?: throw IllegalArgumentException("from missing")
                val value = tx.str("value")?.let(Numeric::toBigInt) ?: BigInteger.ZERO
                val data = (tx.str("data") ?: tx.str("input"))?.takeIf { it.length > 2 }
                account to WcRequestDetail.SendTransaction(
                    to = tx.str("to"),
                    valueDisplay = value.toString(),
                    hasData = data != null,
                    dataPreview = data?.take(74),
                )
            }
            else -> throw IllegalArgumentException(method)
        }
    }

    /** Raw wei → "0.01 BNB" once the network is known. */
    private fun WcRequestDetail.withNetwork(network: EvmNetwork): WcRequestDetail = when (this) {
        is WcRequestDetail.SendTransaction -> copy(
            valueDisplay = BigDecimal(BigInteger(valueDisplay)).movePointLeft(network.nativeDecimals)
                .stripTrailingZeros().toPlainString() + " " + network.nativeSymbol,
        )
        else -> this
    }

    private fun typedDataJson(arr: JsonArray): String = when (val el = arr[1]) {
        is JsonPrimitive -> el.content
        else -> el.toString()
    }

    private fun messageBytes(raw: String): ByteArray =
        if (raw.startsWith("0x") && raw.length % 2 == 0 && raw.drop(2).all { it.isDigit() || it.lowercaseChar() in 'a'..'f' }) {
            Numeric.hexStringToByteArray(raw)
        } else {
            raw.toByteArray(Charsets.UTF_8)
        }

    private fun displayMessage(raw: String): String {
        val bytes = messageBytes(raw)
        val text = String(bytes, Charsets.UTF_8)
        val printable = text.all { !it.isISOControl() || it == '\n' || it == '\r' || it == '\t' }
        return if (printable) text else Numeric.toHexString(bytes)
    }

    private fun trust(ctx: Wallet.Model.VerifyContext): WcTrust = when {
        ctx.isScam == true -> WcTrust.Scam
        ctx.validation == Wallet.Model.Validation.VALID -> WcTrust.Verified
        ctx.validation == Wallet.Model.Validation.INVALID -> WcTrust.Mismatch
        else -> WcTrust.Unknown
    }

    private fun chainLabel(caip: String): String? {
        val id = caip.substringAfter("eip155:", "").toLongOrNull() ?: return null
        return Networks.byChainId(id)?.name ?: "Chain $id"
    }

    private fun activeWallet(): WalletSummary? {
        val list = vault.wallets.value.orEmpty()
        return list.firstOrNull { it.id == vault.activeWalletId.value } ?: list.firstOrNull()
    }

    private fun sessionsOrEmpty(): List<Wallet.Model.Session> =
        if (initialized) runCatching { WalletKit.getListOfActiveSessions() }.getOrDefault(emptyList()) else emptyList()

    private fun refreshSessions() {
        if (!isConfigured()) return
        val sessions = sessionsOrEmpty().map { s ->
            WcSessionSummary(
                topic = s.topic,
                peerName = s.metaData?.name?.ifBlank { null } ?: "dApp",
                peerUrl = s.metaData?.url,
                peerIcon = s.metaData?.icons?.firstOrNull(),
                chains = s.namespaces.values.flatMap { it.chains.orEmpty() }.mapNotNull { chainLabel(it) }.distinct(),
            )
        }
        _state.value = if (sessions.isEmpty()) WcConnectionState.Idle else WcConnectionState.Connected(sessions)
    }

    private fun JsonArray.string(i: Int): String = (get(i) as JsonPrimitive).content
    private fun JsonObject.str(key: String): String? = (get(key) as? JsonPrimitive)?.contentOrNull

    private companion object {
        const val TAG = "WalletConnect"
        const val USER_REJECTED = 4001
        const val UNSUPPORTED_METHOD = 4200
        const val UNSUPPORTED_CHAIN = 5100
        const val INVALID_PARAMS = -32602
        const val APPROVE_SELECTOR = "0x095ea7b3"

        /** eth_sign (raw hash signing) is deliberately excluded: it can sign anything, including transactions. */
        val SUPPORTED_METHODS = listOf("eth_sendTransaction", "personal_sign", "eth_signTypedData", "eth_signTypedData_v4")
        val SUPPORTED_EVENTS = listOf("chainChanged", "accountsChanged")
    }
}
