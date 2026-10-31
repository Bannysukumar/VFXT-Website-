package com.vfxt.wallet.ui.trading

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import com.vfxt.wallet.data.demo.ChartInterval
import com.vfxt.wallet.data.demo.DemoCandle
import com.vfxt.wallet.data.demo.DemoMarketData
import com.vfxt.wallet.data.demo.DemoTicker
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

enum class OrderSide { Buy, Sell }

/** All values are DEMO. The trading module never touches the wallet repository. */
data class TradingUiState(
    val interval: ChartInterval = ChartInterval.H1,
    val candles: List<DemoCandle> = DemoMarketData.candles(ChartInterval.H1),
    val side: OrderSide = OrderSide.Buy,
    val amountInput: String = "",
) {
    val ticker: DemoTicker = DemoMarketData.ticker(candles)

    val amount: Double? get() = amountInput.toDoubleOrNull()?.takeIf { it > 0 }

    /** Estimated order value in demo USDT. */
    val estimatedValue: Double? get() = amount?.let { it * ticker.lastPrice }
}

@HiltViewModel
class TradingViewModel @Inject constructor() : ViewModel() {
    private val _uiState = MutableStateFlow(TradingUiState())
    val uiState: StateFlow<TradingUiState> = _uiState.asStateFlow()

    fun selectInterval(interval: ChartInterval) =
        _uiState.update { it.copy(interval = interval, candles = DemoMarketData.candles(interval)) }

    fun selectSide(side: OrderSide) = _uiState.update { it.copy(side = side) }

    fun updateAmount(input: String) {
        // Digits with at most one decimal separator and 8 fraction digits.
        if (input.isEmpty() || Regex("^\\d{0,12}(\\.\\d{0,8})?$").matches(input)) {
            _uiState.update { it.copy(amountInput = input) }
        }
    }
}
