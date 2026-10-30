import { describe, expect, it } from 'vitest';
import {
  AdminRole,
  canManageFinance,
  getAdminRoleFromClaims,
  hasAnyAdminRole,
  isAdminRole,
  requireAuth,
  requireAdminRole,
  requireEmailVerified,
} from './permissions';
import { AppError } from './errors';
import { CallableRequest } from 'firebase-functions/v2/https';

function mockRequest(
  partial: Partial<CallableRequest> & {
    auth?: CallableRequest['auth'] | null;
  },
): CallableRequest {
  return partial as CallableRequest;
}

describe('isAdminRole / getAdminRoleFromClaims', () => {
  it('recognizes all admin roles', () => {
    expect(isAdminRole('super_admin')).toBe(true);
    expect(isAdminRole('finance_admin')).toBe(true);
    expect(isAdminRole('user')).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });

  it('reads adminRole from claims', () => {
    expect(
      getAdminRoleFromClaims({ adminRole: AdminRole.FinanceAdmin }),
    ).toBe(AdminRole.FinanceAdmin);
    expect(getAdminRoleFromClaims({})).toBeNull();
    expect(getAdminRoleFromClaims(null)).toBeNull();
  });
});

describe('requireAuth', () => {
  it('throws when unauthenticated', () => {
    expect(() => requireAuth(mockRequest({ auth: null }))).toThrow(AppError);
  });

  it('returns context when authenticated', () => {
    const ctx = requireAuth(
      mockRequest({
        auth: {
          uid: 'u1',
          token: {
            email: 'a@b.com',
            email_verified: true,
            adminRole: 'support_admin',
          },
        },
      }),
    );
    expect(ctx.uid).toBe('u1');
    expect(ctx.emailVerified).toBe(true);
    expect(ctx.adminRole).toBe(AdminRole.SupportAdmin);
  });
});

describe('requireAdminRole', () => {
  it('allows matching roles', () => {
    const ctx = requireAdminRole(
      mockRequest({
        auth: {
          uid: 'admin1',
          token: { adminRole: 'super_admin', email_verified: true },
        },
      }),
      [AdminRole.SuperAdmin],
    );
    expect(ctx.adminRole).toBe(AdminRole.SuperAdmin);
  });

  it('denies wrong role', () => {
    expect(() =>
      requireAdminRole(
        mockRequest({
          auth: {
            uid: 'admin1',
            token: { adminRole: 'readonly_admin' },
          },
        }),
        [AdminRole.SuperAdmin, AdminRole.FinanceAdmin],
      ),
    ).toThrow(AppError);
  });
});

describe('requireEmailVerified / helpers', () => {
  it('gates unverified emails', () => {
    expect(() =>
      requireEmailVerified({
        uid: 'u',
        emailVerified: false,
        adminRole: null,
        token: {},
      }),
    ).toThrow(AppError);
  });

  it('finance helpers', () => {
    expect(canManageFinance(AdminRole.FinanceAdmin)).toBe(true);
    expect(canManageFinance(AdminRole.SupportAdmin)).toBe(false);
    expect(hasAnyAdminRole(AdminRole.ReadonlyAdmin)).toBe(true);
    expect(hasAnyAdminRole(null)).toBe(false);
  });
});
