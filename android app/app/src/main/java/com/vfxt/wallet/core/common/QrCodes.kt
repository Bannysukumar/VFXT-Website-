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
     * Extracts an EVM address from scanned text: a bare 0x address or an EIP-681 URI such as
     * `ethereum:0xabc...@56`. Returns null for anything else (never guesses).
     */
    fun extractAddress(text: String): String? {
        val trimmed = text.trim()
        val candidate = trimmed
            .removePrefix("ethereum:")
            .removePrefix("bnb:")
            .removePrefix("pay-")
            .substringBefore('@')
            .substringBefore('?')
            .substringBefore('/')
        return candidate.takeIf { WalletKeyService.isValidAddress(it) }
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
