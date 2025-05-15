
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { UserSession } from '@/app/actions/authActions'; // Import UserSession type

const SESSION_COOKIE_NAME = 'healthwise_session';
const PROTECTED_PATHS = ['/dashboard', '/dashboard/patient', '/dashboard/doctor', '/dashboard/admin', '/dashboard/profile'];
const LOGIN_PATH = '/login';
const CHANGE_PASSWORD_PATH = '/auth/change-password';
const ROOT_PATH = '/';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  let session: UserSession | null = null;

  if (sessionCookie) {
    try {
      session = JSON.parse(sessionCookie.value) as UserSession;
    } catch (error) {
      console.error('Failed to parse session cookie in middleware:', error);
    }
  }

  const isAuthenticated = !!session;

  // Allow access to the root path (landing page) for everyone
  if (pathname === ROOT_PATH) {
    return NextResponse.next();
  }
  
  // Allow access to seed-database page
  if (pathname.startsWith('/seed-database')) {
    return NextResponse.next();
  }

  if (isAuthenticated) {
    // If authenticated and requires password change
    if (session?.requiresPasswordChange) {
      if (pathname === CHANGE_PASSWORD_PATH) {
        return NextResponse.next(); // Allow access to change password page
      }
      // If trying to access any other page, redirect to change password
      return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url));
    }

    // If authenticated and password change NOT required
    if (pathname === LOGIN_PATH || pathname === CHANGE_PASSWORD_PATH) {
      // Already logged in and password change not needed, redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Role-based access for specific dashboards
    if (pathname.startsWith('/dashboard/admin') && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/dashboard/doctor') && session.role !== 'doctor' && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/dashboard/patient') && session.role !== 'patient' && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    return NextResponse.next(); // Allow access to other protected paths like /dashboard or /dashboard/profile
  }

  // Not authenticated
  if (isProtectedPath(pathname) || pathname === CHANGE_PASSWORD_PATH) {
    // If trying to access a protected path or change password page without auth, redirect to login
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  return NextResponse.next();
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(p => pathname.startsWith(p));
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
