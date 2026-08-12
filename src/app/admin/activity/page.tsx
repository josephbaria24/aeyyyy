'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useActivityLogs } from '@/lib/admin/queries';
import {
  ACTIVITY_ACTION_LABEL,
  ACTIVITY_ENTITY_LABEL,
  type ActivityLog,
} from '@/lib/types/activity-log';
import { cn } from '@/lib/utils';

function formatWhen(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const ENTITY_FILTERS = [
  'all',
  'booking',
  'event_booking',
  'event',
  'room',
  'rule',
  'site',
  'gallery',
  'partner',
  'offering',
  'income',
  'expense',
] as const;

export default function AdminActivityPage() {
  const query = useActivityLogs();
  const logs = query.data ?? [];
  const [entity, setEntity] = useState<(typeof ENTITY_FILTERS)[number]>('all');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return logs.filter((log) => {
      if (entity !== 'all' && log.entity !== entity) return false;
      if (!term) return true;
      return (
        log.summary.toLowerCase().includes(term) ||
        (log.actor_email ?? '').toLowerCase().includes(term) ||
        (log.entity_id ?? '').toLowerCase().includes(term)
      );
    });
  }, [entity, logs, q]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Activity log</h2>
        <p className="text-sm text-slate-500">
          Who added, edited, or deleted records, tied to their admin account.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {ENTITY_FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setEntity(id)}
              className={cn(
                'rounded-[9px] px-3 py-1.5 text-xs font-semibold',
                entity === id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'admin-hairline bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              {id === 'all' ? 'All' : ACTIVITY_ENTITY_LABEL[id] ?? id}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search account or summary"
          className="w-full rounded-[9px] admin-hairline px-3 py-2 text-sm sm:max-w-xs dark:bg-slate-950 dark:text-slate-100"
        />
      </div>

      <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
        {query.isPending && !logs.length ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : query.isError ? (
          <p className="px-4 py-10 text-center text-sm text-rose-600">
            Could not load activity.{' '}
            <span className="text-slate-500">Run supabase/activity-logs-schema.sql in Supabase.</span>
          </p>
        ) : (
          <ul className="divide-y dark:divide-slate-800">
            {filtered.map((log) => (
              <ActivityRow key={log.id} log={log} />
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-slate-500">No activity yet.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ log }: { log: ActivityLog }) {
  const action = ACTIVITY_ACTION_LABEL[log.action] ?? log.action;
  const entity = ACTIVITY_ENTITY_LABEL[log.entity] ?? log.entity;
  const tone =
    log.action === 'deleted'
      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
      : log.action === 'created'
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';

  return (
    <li className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', tone)}>
            {action}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {entity}
          </span>
        </div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{log.summary}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {log.actor_email || 'Unknown account'}
        </p>
      </div>
      <p className="shrink-0 text-xs text-slate-400">{formatWhen(log.created_at)}</p>
    </li>
  );
}
