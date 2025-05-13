
import AdminDashboard from '@/components/admin-dashboard';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getSession, type UserSession } from '@/app/actions/authActions';
import { redirect } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default async function AdminDashboardPage() {
  let session: UserSession | null = null;
  let sessionError: string | null = null;
  let isLoadingSession = true;

  try {
    session = await getSession();
  } catch (error) {
    console.error("Error getting session in AdminDashboardPage:", error);
    sessionError = "Failed to retrieve session information.";
  } finally {
    isLoadingSession = false;
  }

  if (isLoadingSession) {
    return <AdminDashboardPageSkeleton message="Verifying session..." />;
  }

  if (sessionError) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Session Error</AlertTitle>
          <AlertDescription>{sessionError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!session) {
    redirect('/login'); // This should be caught by middleware, but as a fallback.
  }

  if (session.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to view the admin dashboard. Your role: {session.role}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <Suspense fallback={<AdminDashboardPageSkeleton />}>
       <main className="flex-grow p-4 md:p-6 lg:p-8">
        <AdminDashboard adminUserId={session.userId} />
      </main>
    </Suspense>
  );
}

function AdminDashboardPageSkeleton({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
      {message && (
        <div className="flex items-center text-lg text-foreground mb-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {message}
        </div>
      )}
      <div className="w-full max-w-6xl p-8 space-y-8 bg-card rounded-lg shadow-md">
        <Skeleton className="h-10 w-1/3 mb-6" /> {/* Title Skeleton */}
        
        {/* User Management Table Skeleton */}
        <div className="mb-8">
          <Skeleton className="h-8 w-1/4 mb-4" /> {/* Card Title */}
          <Skeleton className="h-10 w-full mb-2" /> {/* Table Header */}
          <Skeleton className="h-12 w-full mb-2" /> {/* Table Row 1 */}
          <Skeleton className="h-12 w-full mb-2" /> {/* Table Row 2 */}
          <Skeleton className="h-12 w-full" />      {/* Table Row 3 */}
        </div>

        {/* Audit Logs Table Skeleton */}
        <div>
          <Skeleton className="h-8 w-1/4 mb-4" /> {/* Card Title */}
          <Skeleton className="h-10 w-full mb-2" /> {/* Table Header */}
          <Skeleton className="h-10 w-full mb-2" /> {/* Table Row 1 */}
          <Skeleton className="h-10 w-full mb-2" /> {/* Table Row 2 */}
          <Skeleton className="h-10 w-full" />      {/* Table Row 3 */}
        </div>
      </div>
    </div>
  );
}
