
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'healthwise_session';
const PROTECTED_PATHS = ['/dashboard', '/dashboard/patient', '/dashboard/doctor', '/dashboard/admin', '/dashboard/profile'];
// Removed '/seed-database' from PROTECTED_PATHS as it was previously removed.
const LOGIN_PATH = '/login';
const ROOT_PATH = '/';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  let session = null;

  if (sessionCookie) {
    try {
      session = JSON.parse(sessionCookie.value);
    } catch (error) {
      console.error('Failed to parse session cookie in middleware:', error);
      // Treat as unauthenticated if cookie is malformed
    }
  }

  const isAuthenticated = !!session;

  // Allow access to the root path (landing page) for everyone
  if (pathname === ROOT_PATH) {
    return NextResponse.next();
  }

  // If trying to access login page while authenticated, redirect to dashboard
  if (isAuthenticated && pathname === LOGIN_PATH) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // If trying to access /seed-database page
  if (pathname.startsWith('/seed-database')) {
    // This page is client-rendered and uses a server action.
    // It doesn't strictly need auth protection via middleware if the action itself is protected
    // or if it's considered a developer tool. For now, let's allow access.
    // If it needs protection, add it to PROTECTED_PATHS or handle here.
    return NextResponse.next();
  }


  // Protect dashboard routes
  const isProtectedPath = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  if (isProtectedPath && !isAuthenticated) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  // Role-based access for specific dashboards AFTER initial /dashboard redirection handles role
  // or if user directly accesses specific admin/doctor/patient pages.
  if (isAuthenticated && session) {
    if (pathname.startsWith('/dashboard/admin') && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url)); 
    }
    if (pathname.startsWith('/dashboard/doctor') && session.role !== 'doctor' && session.role !== 'admin') { 
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/dashboard/patient') && session.role !== 'patient' && session.role !== 'admin') { 
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
