export type AdminUser = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
};

export function mapAdminUser(user: {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): AdminUser {
  const name =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    '';
  const bannedUntil = user.banned_until ? Date.parse(user.banned_until) : NaN;
  const banned = Number.isFinite(bannedUntil) && bannedUntil > Date.now();

  return {
    id: user.id,
    email: user.email ?? '',
    name,
    created_at: user.created_at ?? '',
    last_sign_in_at: user.last_sign_in_at ?? null,
    banned,
  };
}
