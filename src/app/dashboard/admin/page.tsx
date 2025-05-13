
import AdminDashboard from '@/components/admin-dashboard';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminDashboardPageSkeleton />}>
      <AdminDashboard />
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
