import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Collections, getDb } from '../../lib/firebase';
import { log } from '../../lib/logger';
import { AuditLogEntry } from '../../types/models';

export interface WriteAuditLogInput {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Append an immutable audit log entry. Never update/delete after write.
 */
export async function writeAuditLog(
  input: WriteAuditLogInput,
): Promise<string> {
  const db = getDb();
  const logId = uuidv4();
  const entry: AuditLogEntry = {
    logId,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: input.metadata ?? {},
    ip: input.ip ?? null,
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection(Collections.auditLogs).doc(logId).set(entry);
  log.info('audit_log_written', {
    logId,
    action: input.action,
    actorId: input.actorId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
  });
  return logId;
}
