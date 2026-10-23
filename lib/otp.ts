import nodemailer from 'nodemailer';
import OTP from '@/models/OTP';
import dbConnect from './db';

// Generate a 6-digit OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP via email
export async function sendEmailOTP(email: string, code: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"CodeSync" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your CodeSync Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #0d1117; border-radius: 10px; color: #ffffff;">
        <h1 style="color: #3b82f6; text-align: center;">CodeSync</h1>
        <p style="text-align: center; font-size: 16px;">Your verification code is:</p>
        <div style="text-align: center; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #3b82f6; padding: 20px; background-color: #161b22; border-radius: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p style="text-align: center; color: #8b949e; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="text-align: center; color: #8b949e; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      </div>
    `,
  });
}

// Send OTP via phone (Twilio)
export async function sendPhoneOTP(phone: string, code: string): Promise<void> {
  const twilio = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  await twilio.messages.create({
    body: `Your CodeSync verification code is: ${code}. It expires in 10 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone,
  });
}

// Create and send OTP
export async function createAndSendOTP(identifier: string, type: 'email' | 'phone'): Promise<boolean> {
  await dbConnect();

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Delete any existing OTPs for this identifier
  await OTP.deleteMany({ identifier });

  // Save new OTP
  await OTP.create({
    identifier,
    code,
    type,
    expiresAt,
  });

  try {
    if (type === 'email') {
      await sendEmailOTP(identifier, code);
    } else {
      await sendPhoneOTP(identifier, code);
    }
    return true;
  } catch (error) {
    console.error('Failed to send OTP:', error);
    return false;
  }
}

// Verify OTP
export async function verifyOTP(identifier: string, code: string): Promise<boolean> {
  await dbConnect();

  const otp = await OTP.findOne({
    identifier,
    code,
    expiresAt: { $gt: new Date() },
    verified: false,
  });

  if (!otp) {
    return false;
  }

  otp.verified = true;
  await otp.save();

  return true;
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"CodeSync" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'CodeSync Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #0d1117; border-radius: 10px; color: #ffffff;">
        <h1 style="color: #3b82f6; text-align: center;">CodeSync</h1>
        <p style="text-align: center; font-size: 16px;">You requested to reset your password.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="text-align: center; color: #8b949e; font-size: 14px;">This link will expire in 1 hour.</p>
        <p style="text-align: center; color: #8b949e; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      </div>
    `,
  });
}