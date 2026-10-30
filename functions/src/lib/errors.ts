import { HttpsError } from 'firebase-functions/v2/https';

/** Stable application error codes surfaced to clients. */
export type ErrorCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'invalid-argument'
  | 'not-found'
  | 'already-exists'
  | 'failed-precondition'
  | 'resource-exhausted'
  | 'unavailable'
  | 'aborted'
  | 'feature-disabled'
  | 'insufficient-balance'
  | 'idempotency-conflict'
  | 'internal';

type HttpsErrorCode =
  | 'ok'
  | 'cancelled'
  | 'unknown'
  | 'invalid-argument'
  | 'deadline-exceeded'
  | 'not-found'
  | 'already-exists'
  | 'permission-denied'
  | 'resource-exhausted'
  | 'failed-precondition'
  | 'aborted'
  | 'out-of-range'
  | 'unimplemented'
  | 'internal'
  | 'unavailable'
  | 'data-loss'
  | 'unauthenticated';

const HTTPS_MAP: Record<ErrorCode, HttpsErrorCode> = {
  unauthenticated: 'unauthenticated',
  'permission-denied': 'permission-denied',
  'invalid-argument': 'invalid-argument',
  'not-found': 'not-found',
  'already-exists': 'already-exists',
  'failed-precondition': 'failed-precondition',
  'resource-exhausted': 'resource-exhausted',
  unavailable: 'unavailable',
  aborted: 'aborted',
  'feature-disabled': 'failed-precondition',
  'insufficient-balance': 'failed-precondition',
  'idempotency-conflict': 'aborted',
  internal: 'internal',
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  toHttpsError(): HttpsError {
    return new HttpsError(HTTPS_MAP[this.code], this.message, {
      code: this.code,
      details: this.details,
    });
  }
}

export class FeatureDisabledError extends AppError {
  constructor(feature: string, message?: string) {
    super(
      'feature-disabled',
      message ?? `Feature "${feature}" is disabled`,
      { feature },
    );
    this.name = 'FeatureDisabledError';
  }
}

/** Wrap a handler so AppError / unknown errors become HttpsError. */
export function wrapCallable<TArgs, TResult>(
  fn: (args: TArgs, uid: string) => Promise<TResult>,
): (request: {
  data: TArgs;
  auth?: { uid: string } | null;
}) => Promise<TResult> {
  return async (request) => {
    try {
      const uid = request.auth?.uid;
      if (!uid) {
        throw new AppError('unauthenticated', 'Authentication required');
      }
      return await fn(request.data, uid);
    } catch (err) {
      if (err instanceof AppError) {
        throw err.toHttpsError();
      }
      if (err instanceof HttpsError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Internal error';
      throw new HttpsError('internal', message);
    }
  };
}
