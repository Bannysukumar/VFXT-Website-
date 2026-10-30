import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import {
  AdminRole,
  requireAuth,
  requireAdminRole,
  PRIVILEGED_ADMIN_ROLES,
} from '../../lib/permissions';
import { log } from '../../lib/logger';
import { SupportMessage, SupportTicket } from '../../types/models';
import {
  addMessageSchema,
  createTicketSchema,
  updateTicketStatusSchema,
} from './schemas';

async function handleCreateTicket(
  request: CallableRequest,
): Promise<{ ticketId: string }> {
  const ctx = requireAuth(request);
  const parsed = createTicketSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const db = getDb();
  const ticketId = uuidv4();
  const ticket: SupportTicket = {
    ticketId,
    userId: ctx.uid,
    subject: parsed.data.subject,
    body: parsed.data.body,
    category: parsed.data.category,
    status: 'open',
    priority: 'normal',
    assigneeId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection(Collections.supportTickets).doc(ticketId).set(ticket);
  log.info('support_ticket_created', { ticketId, uid: ctx.uid });
  return { ticketId };
}

export const createTicket = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleCreateTicket(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function handleAddMessage(
  request: CallableRequest,
): Promise<{ messageId: string }> {
  const ctx = requireAuth(request);
  const parsed = addMessageSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const db = getDb();
  const ticketRef = db
    .collection(Collections.supportTickets)
    .doc(parsed.data.ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) {
    throw new AppError('not-found', 'Ticket not found');
  }

  const ticket = ticketSnap.data() as SupportTicket;
  const isStaff =
    ctx.adminRole !== null &&
    PRIVILEGED_ADMIN_ROLES.includes(ctx.adminRole);

  if (ticket.userId !== ctx.uid && !isStaff) {
    throw new AppError('permission-denied', 'Not allowed to message this ticket');
  }

  if (ticket.status === 'closed') {
    throw new AppError('failed-precondition', 'Ticket is closed');
  }

  const messageId = uuidv4();
  const message: SupportMessage = {
    messageId,
    ticketId: parsed.data.ticketId,
    authorId: ctx.uid,
    body: parsed.data.body,
    isStaff,
    createdAt: FieldValue.serverTimestamp(),
  };

  await ticketRef.collection('messages').doc(messageId).set(message);
  await ticketRef.update({ updatedAt: FieldValue.serverTimestamp() });

  return { messageId };
}

export const addMessage = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleAddMessage(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function handleUpdateTicketStatus(
  request: CallableRequest,
): Promise<{ ticketId: string }> {
  const ctx = requireAdminRole(request, [
    AdminRole.SuperAdmin,
    AdminRole.SupportAdmin,
    AdminRole.OperationsAdmin,
  ]);

  const parsed = updateTicketStatusSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const db = getDb();
  const ref = db
    .collection(Collections.supportTickets)
    .doc(parsed.data.ticketId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new AppError('not-found', 'Ticket not found');
  }

  await ref.update({
    status: parsed.data.status,
    updatedAt: FieldValue.serverTimestamp(),
    assigneeId: ctx.uid,
  });

  log.info('support_ticket_status_updated', {
    ticketId: parsed.data.ticketId,
    status: parsed.data.status,
    actorId: ctx.uid,
  });
  return { ticketId: parsed.data.ticketId };
}

export const updateTicketStatus = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleUpdateTicketStatus(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});
