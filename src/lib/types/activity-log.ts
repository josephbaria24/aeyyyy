export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'status_changed'
  | 'published'
  | 'hidden';

export type ActivityEntity =
  | 'room'
  | 'booking'
  | 'event'
  | 'event_booking'
  | 'rule'
  | 'income'
  | 'expense'
  | 'site'
  | 'gallery'
  | 'partner'
  | 'offering';

export type ActivityLog = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: ActivityAction | string;
  entity: ActivityEntity | string;
  entity_id: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export const ACTIVITY_ACTION_LABEL: Record<string, string> = {
  created: 'Added',
  updated: 'Edited',
  deleted: 'Deleted',
  status_changed: 'Status changed',
  published: 'Published',
  hidden: 'Hidden',
};

export const ACTIVITY_ENTITY_LABEL: Record<string, string> = {
  room: 'Room',
  booking: 'Room booking',
  event: 'Event',
  event_booking: 'Event booking',
  rule: 'Rule',
  income: 'Income',
  expense: 'Expense',
  site: 'Homepage',
  gallery: 'Gallery',
  partner: 'Partner',
  offering: 'Event type',
};
