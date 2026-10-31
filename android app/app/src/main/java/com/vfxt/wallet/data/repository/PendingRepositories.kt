package com.vfxt.wallet.data.repository

import com.vfxt.wallet.domain.models.MiningOverview
import com.vfxt.wallet.domain.models.MiningStatus
import com.vfxt.wallet.domain.repository.MiningRepository
import javax.inject.Inject

/** PENDING (Phase 4): mining is served by the Node.js/Cloud Run backend, which is not wired up yet. */
class PendingMiningRepository @Inject constructor() : MiningRepository {
    override suspend fun loadOverview() = MiningOverview(
        status = MiningStatus.ServiceUnavailable("The mining service will be connected in an upcoming update."),
        rewards = null,
        history = emptyList(),
    )
}
