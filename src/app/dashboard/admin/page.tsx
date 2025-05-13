
import AdminDashboard from '@/components/admin-dashboard';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getSession } from '@/app/actions/authActions';
import { redirect } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default async function AdminDashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
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

function AdminDashboardPageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
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
