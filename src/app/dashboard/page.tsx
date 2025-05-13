
// src/app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/app/actions/authActions';
import { Loader2 } from 'lucide-react';

export default async function DashboardRedirectPage() {
  const session = await getSession();

  if (!session) {
    // This should ideally be caught by middleware, but as a fallback:
    redirect('/login');
  }

  // Redirect based on role
  switch (session.role) {
    case 'patient':
      redirect('/dashboard/patient');
    case 'doctor':
      redirect('/dashboard/doctor');
    case 'admin':
      redirect('/dashboard/admin');
    default:
      // Fallback if role is unknown or not set, redirect to login or a generic error page
      console.warn(`Unknown or missing role for user ${session.userId}: ${session.role}. Redirecting to login.`);
      redirect('/login'); 
  }

  // This part should not be reached if redirection works
  return (
     <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-foreground">Redirecting to your dashboard...</p>
    </div>
  );
}
