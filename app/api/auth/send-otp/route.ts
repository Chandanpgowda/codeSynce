import { NextRequest, NextResponse } from 'next/server';
import { createAndSendOTP } from '@/lib/otp';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, type, mode } = body;

    if (!identifier || !type || !mode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (type !== 'email' && type !== 'phone') {
      return NextResponse.json(
        { error: 'Invalid type. Must be email or phone' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if user exists
    const query = type === 'email' ? { email: identifier.toLowerCase() } : { phone: identifier };
    const existingUser = await User.findOne(query);

    if (mode === 'signup' && existingUser) {
      return NextResponse.json(
        { error: 'An account with this ' + type + ' already exists' },
        { status: 409 }
      );
    }

    if (mode === 'signin' && !existingUser) {
      return NextResponse.json(
        { error: 'No account found with this ' + type },
        { status: 404 }
      );
    }

    const sent = await createAndSendOTP(identifier, type);

    if (!sent) {
      return NextResponse.json(
        { error: 'Failed to send OTP. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}