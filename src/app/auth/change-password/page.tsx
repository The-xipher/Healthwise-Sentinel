
import ChangePasswordForm from '@/components/change-password-form';
import { getSession } from '@/app/actions/authActions';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default async function ChangePasswordPage() {
  let session;
  let sessionError = null;
  let isLoadingSession = true;

  try {
    session = await getSession();
  } catch (error) {
    console.error("Error getting session in ChangePasswordPage:", error);
    sessionError = "Failed to retrieve session information.";
  } finally {
    isLoadingSession = false;
  }

  if (isLoadingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
        <div className="flex items-center text-lg text-foreground mb-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Verifying session...
        </div>
        <ChangePasswordFormSkeleton />
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Session Error</AlertTitle>
          <AlertDescription>{sessionError} Please try logging in again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!session) {
    // Not authenticated, redirect to login
    redirect('/login');
  }

  if (!session.requiresPasswordChange) {
    // Password change not required, redirect to dashboard
    redirect('/dashboard');
  }

  return (
    <Suspense fallback={<ChangePasswordPageSkeleton />}>
      <div className="flex items-center justify-center min-h-screen bg-secondary p-4">
        <ChangePasswordForm userId={session.userId} />
      </div>
    </Suspense>
  );
}

function ChangePasswordPageSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary p-4">
      <ChangePasswordFormSkeleton />
    </div>
  );
}

function ChangePasswordFormSkeleton() {
  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-xl shadow-2xl">
      <div className="text-center">
        <Skeleton className="h-8 w-3/4 mx-auto mb-2" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
