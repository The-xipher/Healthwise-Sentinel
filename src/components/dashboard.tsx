'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { app, db } from '@/lib/firebase'; // Assuming firebase and firestore are configured
import PatientDashboard from './patient-dashboard';
import DoctorDashboard from './doctor-dashboard';
import AdminDashboard from './admin-dashboard'; // Assuming Admin Dashboard exists
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import Header from './header'; // Import the Header component

type UserRole = 'patient' | 'doctor' | 'admin' | null;

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch user role from Firestore
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
             // Basic role check - adapt based on your Firestore structure
            if (userData.role === 'patient' || userData.role === 'doctor' || userData.role === 'admin') {
               setRole(userData.role);
            } else {
               console.warn(`User ${currentUser.uid} has an invalid role: ${userData.role}`);
               setError('Invalid user role assigned.');
               setRole(null); // Or redirect/handle appropriately
            }
          } else {
            // Handle case where user exists in Auth but not in Firestore (e.g., first login)
            // You might want to create a default user profile here or redirect to a setup page.
            console.warn(`User document not found for UID: ${currentUser.uid}. Assigning default role 'patient'.`);
             // For now, let's assign a default role or handle error
            // setError('User profile not found. Please contact support.');
             setRole('patient'); // Assign a default role temporarily
             // TODO: Implement proper user profile creation flow
          }
        } catch (err) {
          console.error("Error fetching user role:", err);
          setError('Failed to fetch user profile. Please try again later.');
          setRole(null);
        }
      } else {
        // No user is signed in, redirect to login
        setUser(null);
        setRole(null);
        router.push('/login');
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth, router]);

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

  // Conditionally render the dashboard based on the role
  const renderDashboard = () => {
    switch (role) {
      case 'patient':
        return <PatientDashboard user={user!} />;
      case 'doctor':
        // Pass necessary props, potentially a list of patients
        return <DoctorDashboard user={user!} />;
      case 'admin':
         return <AdminDashboard user={user!} />;
      default:
        // Should ideally not happen if redirection works correctly
        return <DashboardSkeleton />; // Or an error message
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-secondary">
       {user && <Header user={user} />}
      <main className="flex-grow p-4 md:p-6 lg:p-8">
       {renderDashboard()}
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
           <Skeleton className="h-8 w-20" />
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
