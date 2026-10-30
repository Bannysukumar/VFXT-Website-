import { z } from 'zod';

export const createTicketSchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000),
    category: z
      .enum(['general', 'deposits', 'withdrawals', 'account', 'technical'])
      .default('general'),
  })
  .strict();

export const addMessageSchema = z
  .object({
    ticketId: z.string().min(1).max(128),
    body: z.string().trim().min(1).max(5000),
  })
  .strict();

export const updateTicketStatusSchema = z
  .object({
    ticketId: z.string().min(1).max(128),
    status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  })
  .strict();
