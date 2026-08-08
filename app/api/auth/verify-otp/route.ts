import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import OTP from '@/models/OTP';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, code, type, name, mode } = body;

    if (!identifier || !code || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if OTP is valid (but don't mark as verified - credentials provider will do that)
    const otp = await OTP.findOne({
      identifier,
      code,
      expiresAt: { $gt: new Date() },
      verified: false,
    });

    if (!otp) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP code' },
        { status: 400 }
      );
    }

    let user;

    if (mode === 'signup') {
      // Check if user already exists
      const query = type === 'email' ? { email: identifier.toLowerCase() } : { phone: identifier };
      user = await User.findOne(query);

      if (user) {
        return NextResponse.json(
          { error: 'An account with this ' + type + ' already exists' },
          { status: 409 }
        );
      }

      // Create new user
      user = await User.create({
        name: name || 'CodeSynce User',
        email: type === 'email' ? identifier.toLowerCase() : undefined,
        phone: type === 'phone' ? identifier : undefined,
        provider: type,
        emailVerified: type === 'email',
        phoneVerified: type === 'phone',
        skills: [],
      });
    } else {
      // Sign in - find existing user
      const query = type === 'email' ? { email: identifier.toLowerCase() } : { phone: identifier };
      user = await User.findOne(query);

      if (!user) {
        return NextResponse.json(
          { error: 'No account found with this ' + type },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        image: user.image,
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
