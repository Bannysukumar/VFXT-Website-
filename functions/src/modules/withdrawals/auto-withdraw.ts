import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Collections, getDb } from '../../lib/firebase';
import { log } from '../../lib/logger';
import { getWithdrawSettings } from '../platform/store';
import { walletDocId } from '../wallets/types';
import { debitReserved, reserveFunds } from '../wallets/ledger';
import { createNotification } from '../notifications/handlers';
import type { WithdrawalRequest } from '../../types/models';

/**
 * After a user's first successful withdrawal, when withdrawal wallet
 * available >= admin min, automatically create and send a withdrawal
 * to their saved profile address.
 */
export const processAutoWithdrawals = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'us-central1',
    timeoutSeconds: 300,
  },
  async () => {
    const settings = await getWithdrawSettings();
    if (!settings.autoWithdrawEnabled) return;

    const db = getDb();
    const users = await db
      .collection(Collections.users)
      .where('firstWithdrawalCompletedAt', '!=', null)
      .limit(40)
      .get();

    const { assertBep20Address, sendUsdtBep20 } = await import('../crypto/bsc-usdt');
    const { getHotWalletPublicInfo } = await import('../crypto/hot-wallet');
    const info = await getHotWalletPublicInfo();
    if (!info.configured || info.autoWithdraw === false) return;

    for (const userDoc of users.docs) {
      const user = userDoc.data();
      const uid = userDoc.id;
      const destination =
        (typeof user.walletAddress === 'string' && user.walletAddress) ||
        (typeof user.withdrawalAddress === 'string' && user.withdrawalAddress) ||
        (typeof user.lastWithdrawalAddress === 'string' && user.lastWithdrawalAddress) ||
        null;
      if (!destination) continue;
      if (
        settings.requireProfileAddress &&
        !user.walletAddress &&
        !user.withdrawalAddress
      ) {
        continue;
      }

      try {
        const walletId = walletDocId(uid, 'withdrawal');
        const walletSnap = await db.collection(Collections.wallets).doc(walletId).get();
        if (!walletSnap.exists) continue;
        const available = Number(walletSnap.data()?.availableMinor ?? 0);
        const { getTokenEconomicsSettings } = await import('../platform/store');
        const {
          splitWithdrawalCommission,
          usdCentsToVfxtTokens,
          vfxtTokensToUsdCents,
        } = await import('../../config/plan');
        const tokenFx = await getTokenEconomicsSettings();
        const minTokens = usdCentsToVfxtTokens(
          settings.minWithdrawUsdCents,
          tokenFx.tokensPerUsd,
        );
        if (available < minTokens) continue;

        // Skip if a withdrawal is already processing/pending.
        const open = await db
          .collection(Collections.withdrawals)
          .where('userId', '==', uid)
          .where('status', 'in', ['pending', 'processing', 'approved'])
          .limit(1)
          .get();
        if (!open.empty) continue;

        const toAddress = assertBep20Address(destination);
        const amountMinor = available; // sweep available VFXT (already >= min)
        const usdtAmountCents = vfxtTokensToUsdCents(
          amountMinor,
          tokenFx.tokensPerUsd,
        );
        if (usdtAmountCents < 1) continue;
        const { commissionMinor, netMinor } = splitWithdrawalCommission(
          usdtAmountCents,
          settings.commissionBps,
        );
        if (netMinor <= 0) continue;
        const withdrawalId = uuidv4();

        await db.runTransaction(async (tx) => {
          await reserveFunds(tx, db, {
            userId: uid,
            walletId,
            type: 'withdrawal_reserve',
            amountMinor,
            currency: 'VFXT',
            referenceType: 'withdrawal',
            referenceId: withdrawalId,
            description: 'Auto-withdrawal reserved',
            createdBy: 'system:auto-withdraw',
            metadata: {
              destination: toAddress,
              auto: true,
              commissionMinor,
              netMinor,
              usdtAmountCents,
              tokensPerUsd: tokenFx.tokensPerUsd,
              commissionBps: settings.commissionBps,
            },
          });
          const doc: WithdrawalRequest = {
            withdrawalId,
            userId: uid,
            walletId,
            currency: 'VFXT',
            amountMinor,
            usdtAmountCents,
            commissionMinor,
            netAmountMinor: netMinor,
            commissionBps: settings.commissionBps,
            tokensPerUsd: tokenFx.tokensPerUsd,
            status: 'processing',
            destination: toAddress,
            method: 'usdt_bep20',
            reviewedBy: 'system:auto-withdraw',
            reviewedAt: FieldValue.serverTimestamp(),
            completedAt: null,
            rejectionReason: null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          };
          tx.set(db.collection(Collections.withdrawals).doc(withdrawalId), doc);
        });

        try {
          const { txHash } = await sendUsdtBep20({
            to: toAddress,
            amountUsdCents: netMinor,
          });
          await db.runTransaction(async (tx) => {
            await debitReserved(tx, db, {
              userId: uid,
              walletId,
              type: 'withdrawal_debit',
              amountMinor,
              currency: 'VFXT',
              referenceType: 'withdrawal',
              referenceId: withdrawalId,
              description: `Auto USDT send ${txHash.slice(0, 10)}…`,
              createdBy: 'system:auto-withdraw',
              metadata: {
                txHash,
                destination: toAddress,
                auto: true,
                commissionMinor,
                netMinor,
                usdtAmountCents,
                tokensPerUsd: tokenFx.tokensPerUsd,
              },
            });
            tx.update(db.collection(Collections.withdrawals).doc(withdrawalId), {
              status: 'completed',
              txHash,
              completedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          });
          await createNotification({
            userId: uid,
            type: 'withdrawal_completed',
            title: 'Auto-withdrawal sent',
            body:
              commissionMinor > 0
                ? `Sent $${(netMinor / 100).toFixed(2)} USDT for ${amountMinor.toLocaleString()} VFXT (fee $${(commissionMinor / 100).toFixed(2)}).`
                : 'Your withdrawal wallet reached the minimum and was paid out automatically.',
            data: { withdrawalId, txHash, commissionMinor, netMinor, amountMinor },
          });
          void import('../mail/notify').then(({ sendWithdrawalStatusEmail }) =>
            sendWithdrawalStatusEmail({
              userId: uid,
              status: 'completed',
              amountMinor,
              destination: toAddress,
              txHash,
            }),
          );
          log.info('auto_withdrawal_sent', {
            uid,
            withdrawalId,
            txHash,
            amountMinor,
            commissionMinor,
            netMinor,
          });
        } catch (err) {
          const { releaseReserved } = await import('../wallets/ledger');
          const message = err instanceof Error ? err.message : 'Auto-withdraw failed';
          const publicMessage =
            /hot wallet|balance too low|insufficient|nonce|rpc|broadcast|timed out/i.test(
              message,
            )
              ? 'Withdrawal could not be completed right now. Please try again later or contact admin.'
              : message.length > 180
                ? 'Withdrawal could not be completed right now. Please try again later or contact admin.'
                : message;
          await db.runTransaction(async (tx) => {
            await releaseReserved(tx, db, {
              userId: uid,
              walletId,
              type: 'withdrawal_release',
              amountMinor,
              currency: 'VFXT',
              referenceType: 'withdrawal',
              referenceId: withdrawalId,
              description: 'Auto-withdrawal failed — funds released',
              createdBy: 'system:auto-withdraw',
              metadata: { error: message.slice(0, 500), auto: true },
            });
            tx.update(db.collection(Collections.withdrawals).doc(withdrawalId), {
              status: 'failed',
              rejectionReason: publicMessage,
              updatedAt: FieldValue.serverTimestamp(),
            });
          });
          void import('../mail/notify').then(({ sendWithdrawalStatusEmail }) =>
            sendWithdrawalStatusEmail({
              userId: uid,
              status: 'failed',
              amountMinor,
              destination: toAddress,
              reason: publicMessage,
            }),
          );
          log.warn('auto_withdrawal_failed', { uid, withdrawalId, error: message });
        }
      } catch (err) {
        log.warn('auto_withdrawal_user_skipped', {
          uid,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  },
);
