import { AuthContext, requireEmailVerified } from '../../lib/permissions';
import { FeatureFlags } from '../../config/features';

/** Optionally gate finance ops behind email verification. */
export function gateEmailVerifiedForFinance(ctx: AuthContext): void {
  if (FeatureFlags.requireEmailVerifiedForFinance) {
    requireEmailVerified(ctx);
  }
}

export function isEmailVerified(ctx: AuthContext): boolean {
  return ctx.emailVerified === true;
}
