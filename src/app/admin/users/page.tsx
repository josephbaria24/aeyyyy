'use client';

import { useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, ShieldOff, Trash2, UserPlus, Users } from 'lucide-react';
import { useInvalidateAdmin, useAdminUsers } from '@/lib/admin/queries';
import { logActivity } from '@/lib/admin/activity-log';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { fieldClass, labelClass } from '@/components/admin/content/field';
import type { AdminUser } from '@/lib/types/admin-user';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const emptyForm = { email: '', password: '', name: '' };

function formatWhen(value: string | null) {
  if (!value) return 'Never';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AdminUsersPage() {
  const query = useAdminUsers();
  const invalidate = useInvalidateAdmin();
  const users = query.data?.users ?? [];
  const currentUserId = query.data?.currentUserId ?? '';

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [pendingAccess, setPendingAccess] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(term) || user.name.toLowerCase().includes(term),
    );
  }, [search, users]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const startEdit = (user: AdminUser) => {
    setEditing(user);
    setForm({ email: user.email, password: '', name: user.name });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/admin/users/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            name: form.name,
            password: form.password || undefined,
          }),
        });
        const payload = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(payload.error || 'Could not update user');
        await logActivity({
          action: 'updated',
          entity: 'user',
          entityId: editing.id,
          summary: `Updated admin user ${form.email}`,
        });
        toast.success('User updated');
      } else {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const payload = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(payload.error || 'Could not add user');
        await logActivity({
          action: 'created',
          entity: 'user',
          summary: `Added admin user ${form.email}`,
        });
        toast.success('User added');
      }
      resetForm();
      await invalidate(['users', 'activity']);
    } catch (err) {
      toast.error(editing ? 'Could not update user' : 'Could not add user', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleBanned = async (user: AdminUser) => {
    if (user.id === currentUserId) {
      toast.error('You cannot disable your own account.');
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banned: !user.banned }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error || 'Could not update access');
      await logActivity({
        action: 'status_changed',
        entity: 'user',
        entityId: user.id,
        summary: `${user.banned ? 'Enabled' : 'Disabled'} admin user ${user.email}`,
      });
      await invalidate(['users', 'activity']);
      toast.success(user.banned ? 'User enabled' : 'User disabled');
    } catch (err) {
      toast.error('Could not update access', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const removeUser = async (user: AdminUser) => {
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(payload.error || 'Could not remove user');
    await logActivity({
      action: 'deleted',
      entity: 'user',
      entityId: user.id,
      summary: `Removed admin user ${user.email}`,
    });
    await invalidate(['users', 'activity']);
    toast.success('User removed');
    if (editing?.id === user.id) resetForm();
  };

  const me = users.find((user) => user.id === currentUserId);

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <div className="rounded-[12px] border border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-white p-3 dark:border-indigo-900/40 dark:from-indigo-950/50 dark:to-slate-900 sm:p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 sm:text-xs">
              Admins
            </p>
          </div>
          <p className="text-lg font-bold text-indigo-800 dark:text-indigo-200 sm:text-2xl">{users.length}</p>
        </div>
        <div className="rounded-[12px] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-3 dark:border-emerald-900/40 dark:from-emerald-950/50 dark:to-slate-900 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 sm:text-xs">
            Active
          </p>
          <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300 sm:text-2xl">
            {users.filter((user) => !user.banned).length}
          </p>
        </div>
        <div className="col-span-2 rounded-[12px] border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:col-span-1 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">Signed in as</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {me?.email || '—'}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => void save(e)}
        className="rounded-[12px] admin-hairline bg-white p-4 dark:bg-slate-900 sm:p-6"
      >
        <div className="mb-3 flex items-center gap-2 sm:mb-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            {editing ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          </span>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
            {editing ? 'Edit user' : 'Add user'}
          </h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
          <div>
            <label className={labelClass}>Name</label>
            <input
              placeholder="Display name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              required
              type="email"
              placeholder="admin@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={fieldClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>
              {editing ? 'New password (leave blank to keep current)' : 'Password'}
            </label>
            <input
              required={!editing}
              type="password"
              minLength={editing ? undefined : 8}
              placeholder={editing ? '••••••••' : 'At least 8 characters'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={fieldClass}
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-[9px] bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 sm:py-2.5"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            {editing ? 'Save user' : 'Add user'}
          </button>
          {editing && (
            <button type="button" onClick={resetForm} className="rounded-[9px] px-4 py-2 text-sm text-slate-500">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="overflow-hidden rounded-[12px] admin-hairline bg-white dark:bg-slate-900">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 sm:text-base">All users</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email or name"
            className={`${fieldClass} sm:max-w-xs`}
          />
        </div>

        {query.isPending && !users.length ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : query.error ? (
          <p className="px-4 py-8 text-center text-sm text-rose-600">
            {query.error.message}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((user) => {
              const isMe = user.id === currentUserId;
              return (
                <li key={user.id} className="flex items-start justify-between gap-3 px-3 py-3 sm:px-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                      {user.name || user.email}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                          You
                        </span>
                      )}
                      {user.banned && (
                        <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                          Disabled
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Added {formatWhen(user.created_at)} · Last sign-in {formatWhen(user.last_sign_in_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(user)}
                      className="rounded-[7px] bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      aria-label={`Edit ${user.email}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isMe}
                      onClick={() => setPendingAccess(user)}
                      className={cn(
                        'rounded-[7px] p-2',
                        isMe
                          ? 'cursor-not-allowed bg-slate-50 text-slate-300 dark:bg-slate-800 dark:text-slate-600'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                      )}
                      aria-label={user.banned ? `Enable ${user.email}` : `Disable ${user.email}`}
                    >
                      <ShieldOff className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isMe}
                      onClick={() => setPendingDelete(user)}
                      className={cn(
                        'rounded-[7px] p-2',
                        isMe
                          ? 'cursor-not-allowed bg-slate-50 text-slate-300 dark:bg-slate-800 dark:text-slate-600'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40',
                      )}
                      aria-label={`Remove ${user.email}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-slate-500">No users found.</li>
            )}
          </ul>
        )}
      </div>

      <ConfirmDeleteDialog
        open={pendingAccess != null}
        onOpenChange={(open) => !open && setPendingAccess(null)}
        title={pendingAccess?.banned ? 'Enable this user?' : 'Disable this user?'}
        requireTyping={!pendingAccess?.banned}
        typingValue="DISABLE"
        description={
          pendingAccess?.banned
            ? `“${pendingAccess.email}” will be able to sign in to admin again.`
            : pendingAccess
              ? `“${pendingAccess.email}” will be blocked from signing in.`
              : ''
        }
        confirmLabel={pendingAccess?.banned ? 'Enable user' : 'Disable user'}
        onConfirm={async () => {
          if (pendingAccess) await toggleBanned(pendingAccess);
        }}
      />

      <ConfirmDeleteDialog
        open={pendingDelete != null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Remove this user?"
        requireTyping
        typingValue="DELETE"
        description={
          pendingDelete
            ? `“${pendingDelete.email}” will lose admin access immediately.`
            : ''
        }
        confirmLabel="Remove user"
        onConfirm={async () => {
          if (pendingDelete) await removeUser(pendingDelete);
        }}
      />
    </div>
  );
}
