'use client';

import * as React from 'react';
import PatientDashboard from './patient-dashboard';
// Import other dashboards if you want to switch based on non-auth logic later
// import DoctorDashboard from './doctor-dashboard';
// import AdminDashboard from './admin-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
// Header is now simplified and doesn't need user data
// import Header from './header';

export default function Dashboard() {
  const [loading, setLoading] = React.useState(false); // Keep loading state if data fetching is needed within dashboards
  const [error, setError] = React.useState<string | null>(null);

  // Simulate loading or setup if needed, otherwise set loading to false immediately
  React.useEffect(() => {
     // If dashboards fetch their own data, they handle their loading states.
     // Set loading to false here unless there's a global setup needed.
     setLoading(false);
  }, []);


  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
       <div className="flex items-center justify-center min-h-screen p-4">
         <Alert variant="destructive" className="max-w-md">
           <AlertTriangle className="h-4 w-4" />
           <AlertTitle>Error</AlertTitle>
           <AlertDescription>{error}</AlertDescription>
         </Alert>
       </div>
    );
  }

  // Since authentication is removed, directly render a default dashboard.
  // Here we default to PatientDashboard.
  return (
    <div className="flex flex-col min-h-screen bg-secondary">
       {/* Render the simplified header which doesn't require user */}
       {/* <Header /> */}
       {/* The Header is now part of the RootLayout */}
      <main className="flex-grow p-4 md:p-6 lg:p-8">
       <PatientDashboard />
       {/* You could potentially add logic here later to switch dashboards
           based on URL params or other non-auth state if needed */}
       {/* <DoctorDashboard /> */}
       {/* <AdminDashboard /> */}
      </main>
    </div>
    );
}


function DashboardSkeleton() {
  return (
    <div className="flex flex-col min-h-screen p-4 bg-secondary">
       {/* Skeleton for Header */}
       <div className="bg-card p-4 shadow-sm mb-4">
         <div className="container mx-auto flex justify-between items-center">
           <Skeleton className="h-8 w-32" />
           {/* Remove user-related skeleton */}
           {/* <Skeleton className="h-8 w-20" /> */}
         </div>
       </div>
       {/* Skeleton for Main Content */}
       <div className="flex-grow p-4 md:p-6 lg:p-8">
          <div className="w-full max-w-7xl mx-auto p-8 space-y-8 bg-card rounded-lg shadow-md">
            <Skeleton className="h-10 w-1/3 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-60 rounded-lg md:col-span-2" />
              <Skeleton className="h-60 rounded-lg" />
            </div>
          </div>
        </div>
    </div>
  );
}
