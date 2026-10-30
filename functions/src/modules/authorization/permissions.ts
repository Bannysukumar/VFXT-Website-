/**
 * Re-export permission helpers for the authorization feature module surface.
 */
export {
  AdminRole,
  ALL_ADMIN_ROLES,
  PRIVILEGED_ADMIN_ROLES,
  FINANCE_ROLES,
  requireAuth,
  requireAdminRole,
  requireEmailVerified,
  getAdminRoleFromClaims,
  isAdminRole,
  hasAnyAdminRole,
  canManageFinance,
} from '../../lib/permissions';
export type { AuthContext } from '../../lib/permissions';
