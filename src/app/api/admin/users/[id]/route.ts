import { NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdminSession } from '@/lib/admin/require-admin';
import { mapAdminUser } from '@/lib/types/admin-user';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireAdminSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'User id is required.' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
      banned?: boolean;
    };

    const updates: {
      email?: string;
      password?: string;
      ban_duration?: string;
      user_metadata?: { full_name: string };
    } = {};

    if (typeof body.email === 'string' && body.email.trim()) {
      updates.email = body.email.trim().toLowerCase();
    }
    if (typeof body.password === 'string' && body.password) {
      if (body.password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters.' },
          { status: 400 },
        );
      }
      updates.password = body.password;
    }
    if (typeof body.name === 'string') {
      updates.user_metadata = { full_name: body.name.trim() };
    }
    if (typeof body.banned === 'boolean') {
      updates.ban_duration = body.banned ? '876000h' : 'none';
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data, error } = await admin.auth.admin.updateUserById(id, updates);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data.user) {
      return NextResponse.json({ error: 'User was not updated.' }, { status: 500 });
    }

    return NextResponse.json({ user: mapAdminUser(data.user) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireAdminSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'User id is required.' }, { status: 400 });
  }
  if (id === session.user.id) {
    return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not delete user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
