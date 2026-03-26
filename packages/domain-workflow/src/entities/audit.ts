import type { ActorRef } from '../refs';

export type AuditEventId = string;
export type AuditAggregateType =
  | 'assignment'
  | 'submission'
  | 'review'
  | 'published_result'
  | 'gradebook_entry'
  | 'exam_batch'
  | 'flag';

export interface AuditEvent {
  eventId: AuditEventId;
  aggregateType: AuditAggregateType;
  aggregateId: string;
  eventType: string;
  occurredAt: string;
  actorRef?: ActorRef;
  payload: unknown;
}
