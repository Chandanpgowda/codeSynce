import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isAuthenticated = !!token;
  const role = (token?.role as string) || '';

  const { pathname } = request.nextUrl;

  // ---- Auth pages: redirect authenticated users away ----
  if (pathname.startsWith('/auth/')) {
    if (isAuthenticated) {
      if (role === 'evaluator') {
        return NextResponse.redirect(new URL('/evaluator', request.url));
      }
      return NextResponse.redirect(new URL('/home', request.url));
    }
    return NextResponse.next();
  }

  // ---- Home page: requires authentication ----
  if (pathname === '/home') {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }
    // Builders stay on /home; evaluators go to /evaluator
    if (role === 'evaluator') {
      return NextResponse.redirect(new URL('/evaluator', request.url));
    }
    return NextResponse.next();
  }

  // ---- Evaluator routes: require evaluator role ----
  if (pathname.startsWith('/evaluator')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }
    if (role !== 'evaluator') {
      return NextResponse.redirect(new URL('/home', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/auth/:path*', '/home', '/evaluator/:path*'],
};