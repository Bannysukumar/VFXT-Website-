import { logger as functionsLogger } from 'firebase-functions';

type LogFields = Record<string, unknown>;

function base(fields?: LogFields): LogFields {
  return {
    service: 'vfxt-functions',
    ...fields,
  };
}

/**
 * Structured logger wrapping firebase-functions logger.
 * Prefer structured fields over string interpolation.
 */
export const log = {
  debug(message: string, fields?: LogFields): void {
    functionsLogger.debug(message, base(fields));
  },
  info(message: string, fields?: LogFields): void {
    functionsLogger.info(message, base(fields));
  },
  warn(message: string, fields?: LogFields): void {
    functionsLogger.warn(message, base(fields));
  },
  error(message: string, fields?: LogFields): void {
    functionsLogger.error(message, base(fields));
  },
};
