import { NextRequest, NextResponse } from 'next/server';
import { FOTOAI_SESSION_COOKIE } from '@/lib/fotoai/session-cookie';

const PROTECTED_ROUTES = ['/dashboard', '/chat'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (!isProtected) return NextResponse.next();

  const sessionCookie = request.cookies.get(FOTOAI_SESSION_COOKIE);

  if (!sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/chat/:path*'],
};
