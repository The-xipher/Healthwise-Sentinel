
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'healthwise_session';
const PROTECTED_PATHS = ['/dashboard', '/dashboard/patient', '/dashboard/doctor', '/dashboard/admin'];
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

  // Handle root path: redirect to dashboard if logged in, else to login
  if (pathname === ROOT_PATH) {
    return NextResponse.redirect(new URL(isAuthenticated ? '/dashboard' : LOGIN_PATH, request.url));
  }

  // If trying to access login page while authenticated, redirect to dashboard
  if (isAuthenticated && pathname === LOGIN_PATH) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Protect dashboard routes
  const isProtectedPath = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  if (isProtectedPath && !isAuthenticated) {
    // Preserve the intended URL for redirection after login
    const loginUrl = new URL(LOGIN_PATH, request.url);
    // loginUrl.searchParams.set('redirect', pathname); // Can be used on login page to redirect back
    return NextResponse.redirect(loginUrl);
  }
  
  // Role-based access for specific dashboards after initial /dashboard redirection handles role
  // Example: if a patient tries to access /dashboard/admin directly
  if (isAuthenticated && session) {
    if (pathname.startsWith('/dashboard/admin') && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url)); // Or an unauthorized page
    }
    if (pathname.startsWith('/dashboard/doctor') && session.role !== 'doctor' && session.role !== 'admin') { // Admin might access doctor view
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/dashboard/patient') && session.role !== 'patient' && session.role !== 'admin') { // Admin might access patient view
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
