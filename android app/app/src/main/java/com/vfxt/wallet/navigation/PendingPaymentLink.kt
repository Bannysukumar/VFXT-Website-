package com.vfxt.wallet.navigation

import android.net.Uri
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Holds a payment deep link from the website (vfxtwallet://send?…) until the
 * unlocked app can navigate to Send with recipient / amount / token prefilled.
 */
object PendingPaymentLink {
    data class Pay(
        val recipient: String,
        val amount: String? = null,
        /** ERC-20 contract; null = leave token picker default / native. */
        val tokenAddress: String? = null,
        val chainId: Int? = null,
    )

    private val _pending = MutableStateFlow<Pay?>(null)
    val pending: StateFlow<Pay?> = _pending.asStateFlow()

    fun offer(pay: Pay) {
        _pending.value = pay
    }

    fun consume(): Pay? {
        val current = _pending.value ?: return null
        _pending.value = null
        return current
    }

    fun parse(uri: Uri): Pay? {
        if (!uri.scheme.equals("vfxtwallet", ignoreCase = true)) return null
        val host = uri.host.orEmpty()
        val path = uri.path.orEmpty()
        val isSend =
            host.equals("send", ignoreCase = true) ||
                path.contains("send", ignoreCase = true) ||
                uri.pathSegments.any { it.equals("send", ignoreCase = true) }
        if (!isSend) return null

        val recipient = (
            uri.getQueryParameter("address")
                ?: uri.getQueryParameter("to")
                ?: uri.getQueryParameter("recipient")
            )?.trim().orEmpty()
        if (!recipient.startsWith("0x") || recipient.length < 42) return null

        val amount = (
            uri.getQueryParameter("amount")
                ?: uri.getQueryParameter("value")
            )?.trim()?.takeIf { it.isNotEmpty() }

        val token = (
            uri.getQueryParameter("token")
                ?: uri.getQueryParameter("token_id")
                ?: uri.getQueryParameter("contract")
            )?.trim()?.takeIf { it.startsWith("0x", ignoreCase = true) }

        val chainId = (
            uri.getQueryParameter("chainId")
                ?: uri.getQueryParameter("chain_id")
            )?.toIntOrNull()

        return Pay(
            recipient = recipient,
            amount = amount,
            tokenAddress = token,
            chainId = chainId,
        )
    }
}
