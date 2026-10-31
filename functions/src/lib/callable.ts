import { type CallableOptions, HttpsError } from 'firebase-functions/v2/https'
import { AppError } from './errors'
import { log } from './logger'

/** Default options for all HTTPS callables. */
export const CALLABLE_OPTS: CallableOptions = {
  region: 'us-central1',
  // Explicit origins so browser preflight from production/staging always succeeds.
  cors: [
    'https://virtualfxtrades.com',
    'https://www.virtualfxtrades.com',
    'http://localhost:5173',
    'http://localhost:3029',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3029',
  ],
};

export function toHttpsError(err: unknown): HttpsError {
  if (err instanceof AppError) {
    return err.toHttpsError();
  }
  if (err instanceof HttpsError) {
    return err;
  }
  const message = err instanceof Error ? err.message : 'Internal error';
  log.error('Unhandled callable error', {
    error: message,
    stack: err instanceof Error ? err.stack : undefined,
  });
  if (/iam\.serviceAccounts\.signBlob/i.test(message)) {
    return new HttpsError(
      'failed-precondition',
      'Server cannot mint login tokens. Set ADMIN_SERVICE_ACCOUNT_JSON (Admin SDK key) on Cloud Functions, or grant roles/iam.serviceAccountTokenCreator to the Functions runtime service account.',
    );
  }
  return new HttpsError('internal', 'Internal error');
}
