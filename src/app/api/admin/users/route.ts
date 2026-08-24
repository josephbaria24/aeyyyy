import { NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdminSession } from '@/lib/admin/require-admin';
import { mapAdminUser } from '@/lib/types/admin-user';

export async function GET() {
  const session = await requireAdminSession();
  if ('error' in session) return session.error;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = (data.users ?? [])
      .map(mapAdminUser)
      .sort((a, b) => a.email.localeCompare(b.email));

    return NextResponse.json({ users, currentUserId: session.user.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not list users';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if ('error' in session) return session.error;

  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';
    const name = body.name?.trim() ?? '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: name ? { full_name: name } : undefined,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data.user) {
      return NextResponse.json({ error: 'User was not created.' }, { status: 500 });
    }

    return NextResponse.json({ user: mapAdminUser(data.user) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
