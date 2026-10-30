import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Collections, getDb } from '../../lib/firebase';
import { NotificationDoc } from '../../types/models';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Write a user notification under users/{uid}/notifications. */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<string> {
  const db = getDb();
  const notificationId = uuidv4();
  const doc: NotificationDoc = {
    notificationId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data ?? {},
    read: false,
    readAt: null,
    createdAt: FieldValue.serverTimestamp(),
  };

  await db
    .collection(Collections.users)
    .doc(input.userId)
    .collection('notifications')
    .doc(notificationId)
    .set(doc);

  return notificationId;
}
