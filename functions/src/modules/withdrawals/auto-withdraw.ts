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
        (typeof user.withdrawalAddress === 'string' && user.withdrawalAddress) ||
        (typeof user.lastWithdrawalAddress === 'string' && user.lastWithdrawalAddress) ||
        null;
      if (!destination) continue;
      if (settings.requireProfileAddress && !user.withdrawalAddress) continue;

      try {
        const walletId = walletDocId(uid, 'withdrawal');
        const walletSnap = await db.collection(Collections.wallets).doc(walletId).get();
        if (!walletSnap.exists) continue;
        const available = Number(walletSnap.data()?.availableMinor ?? 0);
        if (available < settings.minWithdrawUsdCents) continue;

        // Skip if a withdrawal is already processing/pending.
        const open = await db
          .collection(Collections.withdrawals)
          .where('userId', '==', uid)
          .where('status', 'in', ['pending', 'processing', 'approved'])
          .limit(1)
          .get();
        if (!open.empty) continue;

        const toAddress = assertBep20Address(destination);
        const amountMinor = available; // sweep available balance (already >= min)
        const { splitWithdrawalCommission } = await import('../../config/plan');
        const { commissionMinor, netMinor } = splitWithdrawalCommission(
          amountMinor,
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
            currency: 'USD',
            referenceType: 'withdrawal',
            referenceId: withdrawalId,
            description: 'Auto-withdrawal reserved',
            createdBy: 'system:auto-withdraw',
            metadata: {
              destination: toAddress,
              auto: true,
              commissionMinor,
              netMinor,
              commissionBps: settings.commissionBps,
            },
          });
          const doc: WithdrawalRequest = {
            withdrawalId,
            userId: uid,
            walletId,
            currency: 'USD',
            amountMinor,
            commissionMinor,
            netAmountMinor: netMinor,
            commissionBps: settings.commissionBps,
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
              currency: 'USD',
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
                ? `Sent $${(netMinor / 100).toFixed(2)} USDT (fee $${(commissionMinor / 100).toFixed(2)}).`
                : 'Your withdrawal wallet reached the minimum and was paid out automatically.',
            data: { withdrawalId, txHash, commissionMinor, netMinor },
          });
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
          await db.runTransaction(async (tx) => {
            await releaseReserved(tx, db, {
              userId: uid,
              walletId,
              type: 'withdrawal_release',
              amountMinor,
              currency: 'USD',
              referenceType: 'withdrawal',
              referenceId: withdrawalId,
              description: 'Auto-withdrawal failed — funds released',
              createdBy: 'system:auto-withdraw',
              metadata: { error: message.slice(0, 500), auto: true },
            });
            tx.update(db.collection(Collections.withdrawals).doc(withdrawalId), {
              status: 'failed',
              rejectionReason: message.slice(0, 1000),
              updatedAt: FieldValue.serverTimestamp(),
            });
          });
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
