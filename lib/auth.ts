import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from './db';
import User from '@/models/User';
import OTP from '@/models/OTP';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    CredentialsProvider({
      name: 'Email/Phone OTP',
      credentials: {
        identifier: { label: 'Email or Phone', type: 'text' },
        code: { label: 'OTP Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.code) {
          return null;
        }

        await dbConnect();

        // Verify OTP code
        const otp = await OTP.findOne({
          identifier: credentials.identifier,
          code: credentials.code,
          expiresAt: { $gt: new Date() },
          verified: false,
        });

        if (!otp) {
          return null;
        }

        // Mark OTP as verified
        otp.verified = true;
        await otp.save();

        // Find user by email or phone
        const user = await User.findOne({
          $or: [
            { email: credentials.identifier.toLowerCase() },
            { phone: credentials.identifier },
          ],
        });

        if (!user) {
          return null;
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account?.provider === 'google') {
        token.provider = 'google';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          await dbConnect();
          const existingUser = await User.findOne({ googleId: user.id });
          
          if (!existingUser) {
            const newUser = await User.create({
              name: user.name,
              email: user.email,
              image: user.image,
              googleId: user.id,
              provider: 'google',
              emailVerified: true,
              skills: [],
            });
            user.id = newUser._id.toString();
          } else {
            user.id = existingUser._id.toString();
          }
          return true;
        } catch (error) {
          console.error('Google sign-in error:', error);
          return false;
        }
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};