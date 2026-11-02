import { onCall } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  nextDailyYieldCents,
  nextDailyYieldDueAtMs,
  vfxtTokensToUsdCents,
} from '../../config/plan';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { AdminRole, requireAdminRole } from '../../lib/permissions';
import { StakingPosition } from '../../types/models';

const FINANCE_ROLES = [
  AdminRole.SuperAdmin,
  AdminRole.FinanceAdmin,
  AdminRole.OperationsAdmin,
  AdminRole.ReadonlyAdmin,
] as const;

const inputSchema = z
  .object({
    /** Invested lookback window. */
    investedPeriod: z
      .enum(['today', 'yesterday', 'last_7_days', 'last_30_days', 'all'])
      .default('today'),
    /** How to define “tomorrow” payouts. */
    payoutWindow: z.enum(['tomorrow', 'next_24h']).default('tomorrow'),
    /** Include open withdrawal queue USDT in “required”. */
    includePendingWithdrawals: z.boolean().default(true),
    /** IANA-ish offset minutes east of UTC (IST = 330). */
    utcOffsetMinutes: z.number().int().min(-720).max(840).default(330),
  })
  .strict();

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Timestamp) return value.toMillis();
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function localDayBounds(
  nowMs: number,
  utcOffsetMinutes: number,
  dayOffset: number,
): { startMs: number; endMs: number } {
  const localNow = nowMs + utcOffsetMinutes * 60_000;
  const d = new Date(localNow);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate() + dayOffset;
  const startUtc = Date.UTC(y, m, day, 0, 0, 0, 0) - utcOffsetMinutes * 60_000;
  const endUtc = Date.UTC(y, m, day + 1, 0, 0, 0, 0) - utcOffsetMinutes * 60_000;
  return { startMs: startUtc, endMs: endUtc };
}

function investedRange(
  nowMs: number,
  utcOffsetMinutes: number,
  period: z.infer<typeof inputSchema>['investedPeriod'],
): { startMs: number | null; endMs: number | null } {
  if (period === 'all') return { startMs: null, endMs: null };
  if (period === 'today') {
    const { startMs, endMs } = localDayBounds(nowMs, utcOffsetMinutes, 0);
    return { startMs, endMs };
  }
  if (period === 'yesterday') {
    const { startMs, endMs } = localDayBounds(nowMs, utcOffsetMinutes, -1);
    return { startMs, endMs };
  }
  const days = period === 'last_7_days' ? 7 : 30;
  const { endMs } = localDayBounds(nowMs, utcOffsetMinutes, 0);
  return { startMs: endMs - days * 86_400_000, endMs };
}

export const getAdminTreasuryAnalytics = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [...FINANCE_ROLES]);
    const parsed = inputSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', parsed.error.issues[0]?.message ?? 'Invalid filters');
    }
    const {
      investedPeriod,
      payoutWindow,
      includePendingWithdrawals,
      utcOffsetMinutes,
    } = parsed.data;

    const db = getDb();
    const nowMs = Date.now();
    const invest = investedRange(nowMs, utcOffsetMinutes, investedPeriod);
    const tomorrow = localDayBounds(nowMs, utcOffsetMinutes, 1);
    const next24hEnd = nowMs + 86_400_000;

    const { getTokenEconomicsSettings } = await import('../platform/store');
    const tokenFx = await getTokenEconomicsSettings();
    const tokensPerUsd = tokenFx.tokensPerUsd;

    let investedTokens = 0;
    let investedPositions = 0;
    let totalActiveStakeTokens = 0;
    let activePositions = 0;
    let tomorrowRoiTokens = 0;
    let tomorrowRoiPositions = 0;
    const tomorrowUsers = new Set<string>();

    // Scan active staking positions (paginated).
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    for (let page = 0; page < 100; page += 1) {
      let q = db
        .collection(Collections.stakingPositions)
        .where('status', '==', 'active')
        .orderBy('__name__')
        .limit(200);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      lastDoc = snap.docs[snap.docs.length - 1]!;

      for (const doc of snap.docs) {
        const p = doc.data() as StakingPosition;
        const principal = Number(p.principalMinor) || 0;
        if (principal <= 0) continue;
        totalActiveStakeTokens += principal;
        activePositions += 1;

        const createdMs = toMillis(p.createdAt);
        if (
          invest.startMs == null ||
          (createdMs >= invest.startMs && createdMs < (invest.endMs ?? Number.MAX_SAFE_INTEGER))
        ) {
          // “Invested in period” counts stakes created in the filter window (active only).
          if (invest.startMs != null || investedPeriod === 'all') {
            if (
              investedPeriod === 'all' ||
              (createdMs >= (invest.startMs ?? 0) &&
                createdMs < (invest.endMs ?? Number.MAX_SAFE_INTEGER))
            ) {
              investedTokens += principal;
              investedPositions += 1;
            }
          }
        }

        if (p.planId !== 'daily_yield') continue;
        const dueMs = nextDailyYieldDueAtMs(createdMs, p.daysPaid ?? 0);
        const inWindow =
          payoutWindow === 'next_24h'
            ? dueMs > nowMs && dueMs <= next24hEnd
            : dueMs >= tomorrow.startMs && dueMs < tomorrow.endMs;
        if (!inWindow) continue;

        const yieldTokens = nextDailyYieldCents({
          principalCents: principal,
          daysPaid: p.daysPaid ?? 0,
          totalPaidMinor: p.totalPaidMinor ?? 0,
          capMinor: p.capMinor ?? principal * 2,
        });
        if (yieldTokens <= 0) continue;
        tomorrowRoiTokens += yieldTokens;
        tomorrowRoiPositions += 1;
        tomorrowUsers.add(p.userId);
      }
      if (snap.size < 200) break;
    }

    // Also count stakes created in period that may already be completed (for “today invested”).
    if (investedPeriod !== 'all' && invest.startMs != null && invest.endMs != null) {
      // Re-scan recent creates regardless of status so “today invested” includes same-day completes.
      let lastCreated: FirebaseFirestore.QueryDocumentSnapshot | null = null;
      let periodInvested = 0;
      let periodCount = 0;
      for (let page = 0; page < 50; page += 1) {
        let q = db
          .collection(Collections.stakingPositions)
          .orderBy('createdAt', 'desc')
          .limit(200);
        if (lastCreated) q = q.startAfter(lastCreated);
        const snap = await q.get();
        if (snap.empty) break;
        lastCreated = snap.docs[snap.docs.length - 1]!;
        let reachedOlder = false;
        for (const doc of snap.docs) {
          const p = doc.data() as StakingPosition;
          const createdMs = toMillis(p.createdAt);
          if (createdMs < invest.startMs) {
            reachedOlder = true;
            break;
          }
          if (createdMs >= invest.endMs) continue;
          periodInvested += Number(p.principalMinor) || 0;
          periodCount += 1;
        }
        if (reachedOlder || snap.size < 200) break;
      }
      investedTokens = periodInvested;
      investedPositions = periodCount;
    }

    let pendingWithdrawTokens = 0;
    let pendingWithdrawUsdtCents = 0;
    let pendingWithdrawCount = 0;
    if (includePendingWithdrawals) {
      const open = await db
        .collection(Collections.withdrawals)
        .where('status', 'in', ['pending', 'approved', 'processing'])
        .limit(500)
        .get();
      for (const doc of open.docs) {
        const w = doc.data();
        pendingWithdrawCount += 1;
        pendingWithdrawTokens += Number(w.amountMinor) || 0;
        const usdt =
          Number(w.netAmountMinor) ||
          Number(w.usdtAmountCents) ||
          vfxtTokensToUsdCents(Number(w.amountMinor) || 0, tokensPerUsd);
        pendingWithdrawUsdtCents += usdt;
      }
    }

    const tomorrowRoiUsdtCents = vfxtTokensToUsdCents(tomorrowRoiTokens, tokensPerUsd);
    const requiredUsdtCents = tomorrowRoiUsdtCents + pendingWithdrawUsdtCents;

    let hotWalletUsdt = 0;
    let hotWalletAddress: string | null = null;
    let hotWalletConfigured = false;
    try {
      const { getHotWalletPublicInfo } = await import('../crypto/hot-wallet');
      const { getHotWalletUsdtBalance } = await import('../crypto/bsc-usdt');
      const info = await getHotWalletPublicInfo();
      hotWalletConfigured = info.configured;
      hotWalletAddress = info.address;
      if (info.configured) {
        const bal = await getHotWalletUsdtBalance();
        hotWalletUsdt = Number.parseFloat(bal.balanceUsdt) || 0;
      }
    } catch {
      hotWalletUsdt = 0;
    }

    const hotWalletUsdtCents = Math.round(hotWalletUsdt * 100);
    const shortfallUsdtCents = Math.max(0, requiredUsdtCents - hotWalletUsdtCents);
    const surplusUsdtCents = Math.max(0, hotWalletUsdtCents - requiredUsdtCents);
    const coveragePct =
      requiredUsdtCents > 0
        ? Math.min(999, Math.round((hotWalletUsdtCents / requiredUsdtCents) * 100))
        : 100;

    return {
      generatedAt: new Date(nowMs).toISOString(),
      filters: {
        investedPeriod,
        payoutWindow,
        includePendingWithdrawals,
        utcOffsetMinutes,
      },
      tokensPerUsd,
      invested: {
        tokens: investedTokens,
        usdtCents: vfxtTokensToUsdCents(investedTokens, tokensPerUsd),
        positions: investedPositions,
        period: investedPeriod,
      },
      totalActiveStake: {
        tokens: totalActiveStakeTokens,
        usdtCents: vfxtTokensToUsdCents(totalActiveStakeTokens, tokensPerUsd),
        positions: activePositions,
      },
      tomorrowPayout: {
        tokens: tomorrowRoiTokens,
        usdtCents: tomorrowRoiUsdtCents,
        positions: tomorrowRoiPositions,
        users: tomorrowUsers.size,
        window: payoutWindow,
      },
      pendingWithdrawals: {
        tokens: pendingWithdrawTokens,
        usdtCents: pendingWithdrawUsdtCents,
        count: pendingWithdrawCount,
      },
      hotWallet: {
        configured: hotWalletConfigured,
        address: hotWalletAddress,
        usdt: hotWalletUsdt,
        usdtCents: hotWalletUsdtCents,
      },
      required: {
        usdtCents: requiredUsdtCents,
        shortfallUsdtCents,
        surplusUsdtCents,
        coveragePct,
      },
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});
