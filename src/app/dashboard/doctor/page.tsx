
import DoctorDashboard from '@/components/doctor-dashboard';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DoctorDashboardPage() {
  return (
    <Suspense fallback={<DoctorDashboardPageSkeleton />}>
      <DoctorDashboard />
    </Suspense>
  );
}

function DoctorDashboardPageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
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
