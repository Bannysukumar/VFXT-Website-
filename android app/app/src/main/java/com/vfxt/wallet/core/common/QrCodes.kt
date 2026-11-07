package com.vfxt.wallet.core.common

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import com.vfxt.wallet.blockchain.wallet.WalletKeyService

object QrCodes {

    /** Renders [content] as a QR code bitmap. Pure function, safe to call off the main thread. */
    fun render(content: String, sizePx: Int): Bitmap {
        val hints = mapOf(
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
            EncodeHintType.MARGIN to 1,
        )
        val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints)
        val pixels = IntArray(sizePx * sizePx) { i ->
            if (matrix[i % sizePx, i / sizePx]) Color.BLACK else Color.WHITE
        }
        return Bitmap.createBitmap(pixels, sizePx, sizePx, Bitmap.Config.ARGB_8888)
    }

    /**
     * Parsed payment / send target from a QR or pasted URI.
     * For EIP-681 ERC-20 transfers (`…/transfer?address=0x…`) [recipient] is the `address`
     * query param — never the token contract in the path.
     */
    data class PaymentTarget(
        val recipient: String,
        /** BEP-20 contract when the URI names one; null for native / bare addresses. */
        val tokenAddress: String? = null,
    )

    /**
     * Extracts an EVM **recipient** address from scanned text: a bare 0x address or an EIP-681 URI.
     * For token-transfer URIs like `ethereum:0xToken@56/transfer?address=0xTo&uint256=…`,
     * returns `0xTo` (not the token contract). Returns null when nothing valid is found.
     */
    fun extractAddress(text: String): String? = extractPayment(text)?.recipient

    /** Like [extractAddress] but also returns the token contract when present in an EIP-681 URI. */
    fun extractPayment(text: String): PaymentTarget? {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return null

        val uriLike = trimmed.startsWith("ethereum:", ignoreCase = true) ||
            trimmed.startsWith("bnb:", ignoreCase = true) ||
            trimmed.startsWith("pay-", ignoreCase = true) ||
            trimmed.contains("/transfer", ignoreCase = true)

        if (uriLike) {
            // ERC-20 transfer: recipient lives in ?address= / &address=
            val transferRecipient = queryParam(trimmed, "address")
                ?.takeIf { WalletKeyService.isValidAddress(it) }
            val pathContract = trimmed
                .removePrefix("ethereum:")
                .removePrefix("bnb:")
                .removePrefix("pay-")
                .substringBefore('@')
                .substringBefore('?')
                .substringBefore('/')
                .takeIf { WalletKeyService.isValidAddress(it) }

            // ERC-20 transfer URIs put the token contract in the path and the wallet in ?address=.
            if (trimmed.contains("/transfer", ignoreCase = true)) {
                val recipient = transferRecipient ?: return null
                val token = pathContract?.takeUnless { it.equals(recipient, ignoreCase = true) }
                return PaymentTarget(recipient = recipient, tokenAddress = token)
            }

            // Native / contract-interaction: path address is the destination.
            pathContract?.let { return PaymentTarget(recipient = it) }
        }

        return trimmed.takeIf { WalletKeyService.isValidAddress(it) }?.let { PaymentTarget(recipient = it) }
    }

    private fun queryParam(text: String, name: String): String? {
        val match = Regex("""[?&]$name=([^&]+)""", RegexOption.IGNORE_CASE).find(text) ?: return null
        // Addresses are unescaped 0x… hex; avoid android.net.Uri so unit tests stay pure-JVM.
        return match.groupValues[1].trim().takeIf { it.isNotEmpty() }
    }

    /**
     * Launches Google's code scanner (camera handled by Play services; the app needs no camera
     * permission). Calls [onResult] with the raw text, or null if cancelled/unavailable.
     */
    fun scan(context: Context, onResult: (String?) -> Unit) {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
        GmsBarcodeScanning.getClient(context, options)
            .startScan()
            .addOnSuccessListener { onResult(it.rawValue) }
            .addOnCanceledListener { onResult(null) }
            .addOnFailureListener { onResult(null) }
    }
}
