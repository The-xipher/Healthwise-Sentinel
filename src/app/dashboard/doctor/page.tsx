
import DoctorDashboard from '@/components/doctor-dashboard';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getSession, type UserSession } from '@/app/actions/authActions';
import { redirect } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default async function DoctorDashboardPage() {
  let session: UserSession | null = null;
  let sessionError: string | null = null;
  let isLoadingSession = true;

  try {
    session = await getSession();
  } catch (error) {
    console.error("Error getting session in DoctorDashboardPage:", error);
    sessionError = "Failed to retrieve session information.";
  } finally {
    isLoadingSession = false;
  }
  
  if (isLoadingSession) {
    return <DoctorDashboardPageSkeleton message="Verifying session..." />;
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
    redirect('/login');
  }

  if (session.role !== 'doctor' && session.role !== 'admin') { // Admin can view doctor dashboard
     return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to view this page. Your role: {session.role}</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // If admin is viewing, they might use a default doctor ID or need a selector.
  // For now, pass their own ID if they are a doctor, or a demo doctor ID if admin.
  // IMPORTANT: Update this demo doctor ID if "607f1f77bcf86cd799439012" (Dr. Ada Lovelace) is not appropriate or causes issues.
  const doctorIdToUse = session.role === 'doctor' ? session.userId : "607f1f77bcf86cd799439012"; // Default Dr. Ada for admin view

  return (
    <Suspense fallback={<DoctorDashboardPageSkeleton />}>
      <main className="flex-grow p-4 md:p-6 lg:p-8">
        <DoctorDashboard doctorId={doctorIdToUse} doctorName={session.displayName} userRole={session.role} />
      </main>
    </Suspense>
  );
}

function DoctorDashboardPageSkeleton({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
      {message && (
        <div className="flex items-center text-lg text-foreground mb-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {message}
        </div>
      )}
      <div className="w-full max-w-7xl p-8 space-y-8 bg-card rounded-lg shadow-md">
        <Skeleton className="h-10 w-1/3 mb-4" /> {/* Title Skeleton */}
        
        {/* Patient Selector Skeleton */}
        <div className="mb-6">
          <Skeleton className="h-12 w-full md:w-1/3" />
        </div>

        {/* Dashboard Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 Skeletons */}
          <div className="lg:col-span-1 space-y-6">
            <Skeleton className="h-40 rounded-lg" /> {/* Patient Info Card */}
            <Skeleton className="h-60 rounded-lg" /> {/* AI Summary Card */}
            <Skeleton className="h-52 rounded-lg" /> {/* AI Care Plan Card */}
          </div>
          {/* Column 2 Skeletons */}
          <div className="lg:col-span-1 space-y-6">
            <Skeleton className="h-48 rounded-lg" /> {/* Health Data Card */}
            <Skeleton className="h-48 rounded-lg" /> {/* Medications Card */}
            <Skeleton className="h-52 rounded-lg" /> {/* AI Suggestions Card */}
          </div>
          {/* Column 3 Skeletons */}
          <div className="lg:col-span-1 space-y-6">
            <Skeleton className="h-[460px] rounded-lg" /> {/* Chat Card */}
          </div>
        </div>
      </div>
    </div>
  );
}
