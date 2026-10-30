import { CallableRequest } from 'firebase-functions/v2/https';
import { AppError } from './errors';

/** Admin roles stored in custom claims as `adminRole`. */
export enum AdminRole {
  SuperAdmin = 'super_admin',
  FinanceAdmin = 'finance_admin',
  OperationsAdmin = 'operations_admin',
  SupportAdmin = 'support_admin',
  ReadonlyAdmin = 'readonly_admin',
}

export const ALL_ADMIN_ROLES: readonly AdminRole[] = [
  AdminRole.SuperAdmin,
  AdminRole.FinanceAdmin,
  AdminRole.OperationsAdmin,
  AdminRole.SupportAdmin,
  AdminRole.ReadonlyAdmin,
];

export const PRIVILEGED_ADMIN_ROLES: readonly AdminRole[] = [
  AdminRole.SuperAdmin,
  AdminRole.FinanceAdmin,
  AdminRole.OperationsAdmin,
  AdminRole.SupportAdmin,
];

export const FINANCE_ROLES: readonly AdminRole[] = [
  AdminRole.SuperAdmin,
  AdminRole.FinanceAdmin,
];

export function isAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === 'string' &&
    (ALL_ADMIN_ROLES as readonly string[]).includes(value)
  );
}

export function getAdminRoleFromClaims(
  claims: Record<string, unknown> | undefined | null,
): AdminRole | null {
  if (!claims) return null;
  const role = claims.adminRole;
  return isAdminRole(role) ? role : null;
}

export interface AuthContext {
  uid: string;
  email?: string;
  emailVerified: boolean;
  adminRole: AdminRole | null;
  token: Record<string, unknown>;
}

/** Require a signed-in user; returns auth context. */
export function requireAuth(request: CallableRequest): AuthContext {
  if (!request.auth?.uid) {
    throw new AppError('unauthenticated', 'Authentication required');
  }
  const token = (request.auth.token ?? {}) as Record<string, unknown>;
  return {
    uid: request.auth.uid,
    email: typeof token.email === 'string' ? token.email : undefined,
    emailVerified: token.email_verified === true,
    adminRole: getAdminRoleFromClaims(token),
    token,
  };
}

/** Require auth + one of the allowed admin roles. */
export function requireAdminRole(
  request: CallableRequest,
  allowed: readonly AdminRole[],
): AuthContext {
  const ctx = requireAuth(request);
  if (!ctx.adminRole || !allowed.includes(ctx.adminRole)) {
    throw new AppError(
      'permission-denied',
      'Insufficient admin privileges',
      { required: allowed, actual: ctx.adminRole },
    );
  }
  return ctx;
}

/** Gate that email must be verified (optional product policy). */
export function requireEmailVerified(ctx: AuthContext): void {
  if (!ctx.emailVerified) {
    throw new AppError(
      'failed-precondition',
      'Email verification required',
    );
  }
}

export function hasAnyAdminRole(role: AdminRole | null): boolean {
  return role !== null && ALL_ADMIN_ROLES.includes(role);
}

export function canManageFinance(role: AdminRole | null): boolean {
  return role !== null && FINANCE_ROLES.includes(role);
}
