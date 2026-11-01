package com.vfxt.wallet.ui.support

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.data.repository.AppNotification
import com.vfxt.wallet.data.repository.NotificationsRepository
import com.vfxt.wallet.data.repository.NotificationsState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val repository: NotificationsRepository,
) : ViewModel() {

    val state: StateFlow<NotificationsState> =
        repository.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), NotificationsState.Loading)

    fun open(item: AppNotification) {
        if (!item.read) viewModelScope.launch { runCatching { repository.markRead(item.id) } }
    }

    fun markAllRead() {
        val items = (state.value as? NotificationsState.Ready)?.items ?: return
        viewModelScope.launch { runCatching { repository.markAllRead(items) } }
    }
}
