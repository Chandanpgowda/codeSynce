import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth-guard';

/**
 * Controlled evaluator on-boarding.
 *
 * The role is ALWAYS set server-side and is never trusted from client input.
 * A user becomes an EVALUATOR only if:
 *   (a) they provide the correct EVALUATOR_INVITE_KEY (env), OR
 *   (b) an existing EVALUATOR explicitly grants (or revokes) the role.
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const me = await getAuthUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { inviteKey, toUser, grant } = body;

    // Path A: self-provision with the institution invite key.
    if (typeof inviteKey === 'string' && inviteKey.length > 0) {
      const configured = process.env.EVALUATOR_INVITE_KEY;
      if (!configured) {
        return NextResponse.json(
          { error: 'Evaluator provisioning is not configured on this instance.' },
          { status: 503 }
        );
      }
      // Constant-time-ish comparison to avoid naive timing hints.
      const a = Buffer.from(inviteKey);
      const b = Buffer.from(configured);
      if (a.length !== b.length) {
        return NextResponse.json({ error: 'Invalid invite key' }, { status: 403 });
      }
      // Timing-safe compare
      let mismatch = 0;
      for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
      if (mismatch !== 0) {
        return NextResponse.json({ error: 'Invalid invite key' }, { status: 403 });
      }

      await User.findByIdAndUpdate(me.id, { role: 'evaluator' });
      return NextResponse.json({ success: true, role: 'evaluator' });
    }

    // Path B: an existing EVALUATOR grants/revokes the role for another user.
    if (toUser) {
      if (me.role !== 'evaluator') {
        return NextResponse.json({ error: 'Forbidden: evaluator role required' }, { status: 403 });
      }
      const target = await User.findById(toUser);
      if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const newRole = grant === false ? 'builder' : 'evaluator';
      await User.findByIdAndUpdate(target._id, { role: newRole });
      return NextResponse.json({ success: true, userId: target._id.toString(), role: newRole });
    }

    return NextResponse.json({ error: 'Provide an invite key or an evaluator grant' }, { status: 400 });
  } catch (error) {
    console.error('Evaluator provisioning error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}