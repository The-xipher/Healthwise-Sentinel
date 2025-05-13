
// src/app/dashboard/patient/page.tsx
import PatientDashboard from '@/components/patient-dashboard';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getSession } from '@/app/actions/authActions';
import { redirect } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default async function PatientSpecificDashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'patient' && session.role !== 'admin') { // Admin can view patient dashboard
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
  
  // If admin is viewing, they might need to select a patient or use a default.
  // For now, pass their own ID if they are a patient, or a demo patient ID if admin.
  // This logic can be refined if admins need to select specific patients.
  const patientIdToView = session.role === 'patient' ? session.userId : "607f1f77bcf86cd799439011"; // Default patient for admin view

  return (
    <Suspense fallback={<PatientDashboardPageSkeleton />}>
      <main className="flex-grow p-4 md:p-6 lg:p-8">
        <PatientDashboard userId={patientIdToView} userRole={session.role} />
      </main>
    </Suspense>
  );
}

function PatientDashboardPageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
      <div className="w-full max-w-7xl mx-auto p-8 space-y-8 bg-card rounded-lg shadow-md">
        <Skeleton className="h-10 w-1/3 mb-6" /> {/* Title Skeleton */}
        
        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>

        {/* Chart Skeleton */}
        <Skeleton className="h-80 rounded-lg mb-6" />

        {/* Medications and Symptoms Sections Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-64 rounded-lg" /> {/* Medications Card */}
          </div>
          <div className="lg:col-span-1">
            <Skeleton className="h-96 rounded-lg" /> {/* Symptom Report Card */}
          </div>
        </div>
      </div>
    </div>
  );
}
