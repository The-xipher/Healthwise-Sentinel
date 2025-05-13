
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'healthwise_session';

export async function POST(request: NextRequest) {
  cookies().delete(SESSION_COOKIE_NAME);
  // Redirect to login page after logout
  // Ensure the redirect URL is absolute for API routes
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl, { status: 302 });
}

// Optional: Handle GET requests to this route if needed, e.g., by redirecting or returning an error.
export async function GET(request: NextRequest) {
    // Typically logout shouldn't be a GET request for security reasons (CSRF)
    // but if accessed directly, redirect to login or show a message.
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl, { status: 302 });
}
