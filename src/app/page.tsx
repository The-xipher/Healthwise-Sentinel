
// src/app/page.tsx

// The root page "/" is now primarily handled by the middleware.
// If a user is authenticated, middleware redirects to /dashboard.
// If not authenticated, middleware redirects to /login.
// This component might render briefly or not at all if middleware handles the redirect.
// It can serve as a fallback or a loading indicator if needed.

import { Loader2 } from 'lucide-react';

export default function RootPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg">Loading HealthWise Hub...</p>
    </div>
  );
}
