
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'healthwise_session';
const PROTECTED_PATHS = ['/dashboard', '/dashboard/patient', '/dashboard/doctor', '/dashboard/admin', '/dashboard/profile', '/seed-database'];
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

  // If trying to access login page while authenticated, redirect to dashboard
  if (isAuthenticated && pathname === LOGIN_PATH) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If trying to access root path while authenticated and it's not already the dashboard,
  // and user is not trying to logout or access an API.
  // We allow authenticated users to see the landing page.
  // The `Access Your Dashboard` button on landing page will take them to `/dashboard`.
  if (pathname === ROOT_PATH) {
    return NextResponse.next(); // Allow landing page to render
  }


  // Protect dashboard routes and seed-database page
  const isProtectedPath = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  if (isProtectedPath && !isAuthenticated) {
    // Preserve the intended URL for redirection after login
    const loginUrl = new URL(LOGIN_PATH, request.url);
    // loginUrl.searchParams.set('redirect', pathname); // Can be used on login page to redirect back
    return NextResponse.redirect(loginUrl);
  }
  
  // Role-based access for specific dashboards AFTER initial /dashboard redirection handles role
  // or if user directly accesses specific admin/doctor/patient pages.
  if (isAuthenticated && session) {
    if (pathname.startsWith('/dashboard/admin') && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url)); // Or an unauthorized page
    }
    // Admin can view doctor dashboard. Doctor can view doctor dashboard.
    if (pathname.startsWith('/dashboard/doctor') && session.role !== 'doctor' && session.role !== 'admin') { 
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // Admin can view patient dashboard. Patient can view patient dashboard.
    if (pathname.startsWith('/dashboard/patient') && session.role !== 'patient' && session.role !== 'admin') { 
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // All roles can view their own profile page. Path is /dashboard/profile
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
