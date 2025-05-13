
// src/app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getSession, type UserSession } from '@/app/actions/authActions';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default async function DashboardRedirectPage() {
  let session: UserSession | null = null;
  let error: string | null = null;

  try {
    session = await getSession();
  } catch (e: any) {
    console.error("Error fetching session in DashboardRedirectPage:", e);
    error = e.message || "An error occurred while trying to access your session.";
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Session Error</AlertTitle>
          <AlertDescription>
            Could not retrieve your session details. Please try logging out and signing in again.
            If the problem persists, contact support. Error: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (!session) {
    // This should ideally be caught by middleware, but as a fallback:
    redirect('/login');
  }

  // Redirect based on role
  switch (session.role) {
    case 'patient':
      redirect('/dashboard/patient');
      break; 
    case 'doctor':
      redirect('/dashboard/doctor');
      break;
    case 'admin':
      redirect('/dashboard/admin');
      break;
    default:
      // Fallback if role is unknown or not set, redirect to login or a generic error page
      console.warn(`Unknown or missing role for user ${session.userId}: ${session.role}. Redirecting to login.`);
      redirect('/login'); 
      break;
  }

  // This part should not be reached if redirection works as expected.
  // It acts as a visual cue during the very brief moment before redirect takes full effect.
  return (
     <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-foreground">Redirecting to your dashboard...</p>
    </div>
  );
}
