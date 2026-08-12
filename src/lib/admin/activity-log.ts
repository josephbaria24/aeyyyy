import { createClient } from '@/lib/supabase/client';
import type { ActivityAction, ActivityEntity } from '@/lib/types/activity-log';

type LogActivityInput = {
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string | null;
  summary: string;
  details?: Record<string, unknown> | null;
};

/** Records an admin mutation. Never throws — logging must not block the save. */
export async function logActivity(input: LogActivityInput) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('activity_logs').insert({
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      summary: input.summary,
      details: input.details ?? null,
    });
    if (error) {
      console.warn('activity log skipped:', error.message);
    }
  } catch (err) {
    console.warn('activity log skipped:', err);
  }
}
