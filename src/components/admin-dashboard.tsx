'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
// Removed: import { User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, isFirebaseInitialized, getFirebaseConfigError } from '@/lib/firebase'; // Import helpers
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Import Alert components
import { Users, Activity, ShieldCheck, AlertTriangle } from 'lucide-react'; // Added icons

// Removed: interface AdminDashboardProps {
//   user: User; // Admin's user object
// }

interface AppUser {
  id: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  role?: 'patient' | 'doctor' | 'admin';
  lastSignInTime?: string; // From Firebase Auth UserMetadata
  creationTime?: string; // From Firebase Auth UserMetadata
  // Add other relevant fields from your Firestore 'users' collection
}

// Simulated log entry type
interface AuditLog {
    id: string;
    timestamp: Date;
    userId: string; // UID of user performing action
    userEmail?: string;
    action: string; // e.g., 'login', 'view_patient_data', 'update_medication'
    details?: string; // Optional details
}

// Placeholder admin info since auth is removed
const PLACEHOLDER_ADMIN_ID = 'test-admin-id';
const PLACEHOLDER_ADMIN_EMAIL = 'admin@example.com';

export default function AdminDashboard(/* Removed: { user }: AdminDashboardProps */) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]); // State for logs
  const [loadingLogs, setLoadingLogs] = useState(true); // Loading state for logs
  const [error, setError] = useState<string | null>(null);
  const [firebaseActive, setFirebaseActive] = useState(false);


  useEffect(() => {
    const firebaseReady = isFirebaseInitialized();
    setFirebaseActive(firebaseReady);
    if (!firebaseReady) {
        setError(getFirebaseConfigError() || "Firebase is not available.");
        setLoadingUsers(false);
        setLoadingLogs(false);
        return; // Stop if Firebase isn't working
    }
    // If Firebase is ready, proceed
    setError(null); // Clear potential config error

    setLoadingUsers(true);
    const usersQuery = query(collection(db!, 'users')); // Use db! non-null assertion

    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as AppUser));
      setUsers(userList);
      setLoadingUsers(false);
    }, (err) => {
      console.error("Error fetching users:", err);
      setError("Could not load user list.");
      setLoadingUsers(false);
    });

    // Simulate fetching audit logs (replace with actual Firestore query if needed later)
    setLoadingLogs(true);
    const fetchLogs = async () => {
        // --- Simulation Starts ---
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
        const simulatedLogs: AuditLog[] = [
            { id: 'log1', timestamp: new Date(), userId: 'doctor_abc', userEmail: 'dr.smith@hospital.org', action: 'view_patient_data', details: 'Patient ID: patient_xyz' },
            { id: 'log2', timestamp: new Date(Date.now() - 60000 * 5), userId: 'patient_xyz', userEmail: 'patient@mail.com', action: 'symptom_report', details: 'Severity: moderate' },
            { id: 'log3', timestamp: new Date(Date.now() - 60000 * 10), userId: PLACEHOLDER_ADMIN_ID, userEmail: PLACEHOLDER_ADMIN_EMAIL, action: 'login', details: 'Admin logged in (Simulated)' },
            { id: 'log4', timestamp: new Date(Date.now() - 60000 * 15), userId: 'doctor_abc', userEmail: 'dr.smith@hospital.org', action: 'approve_suggestion', details: 'Suggestion ID: sug_123' },
        ];
        setAuditLogs(simulatedLogs);
        setLoadingLogs(false);
        // --- Simulation Ends ---
    };
    fetchLogs();


    return () => {
        unsubscribeUsers();
        // Unsubscribe logs if you implement a real listener
    }
  }, []); // Run only once on mount


  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  };

  const formatDate = (dateString: string | undefined): string => {
     if (!dateString) return 'N/A';
     try {
        return new Date(dateString).toLocaleDateString();
     } catch {
        return 'Invalid Date';
     }
   };

  const formatDateTime = (date: Date | undefined): string => {
     if (!date) return 'N/A';
     return date.toLocaleString();
   };

   // Determine if we should show loading skeletons
   const showSkeleton = firebaseActive && (loadingUsers || loadingLogs);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
        <ShieldCheck className="h-7 w-7"/> Admin Portal
      </h1>

      {error && (
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

       {!firebaseActive && !error && (
           <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800">
               <AlertTriangle className="h-4 w-4 text-yellow-600" />
               <AlertTitle>Firebase Disabled</AlertTitle>
               <AlertDescription>
                   Database features are currently offline. User and log data cannot be loaded or managed.
               </AlertDescription>
           </Alert>
       )}

      {/* User Management Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/> User Management</CardTitle>
          <CardDescription>View and manage all users in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created On</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showSkeleton ? (
                // Skeleton Loader for Table Rows
                 Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                  </TableRow>
                 ))
              ) : firebaseActive && users.length > 0 ? (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.photoURL || undefined} alt={u.displayName || 'User'} />
                          <AvatarFallback>{getInitials(u.displayName)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{u.displayName || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{u.email || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'admin' ? 'destructive' : u.role === 'doctor' ? 'secondary' : 'outline'} className="capitalize">
                        {u.role || 'N/A'}
                      </Badge>
                    </TableCell>
                     <TableCell>{formatDate(u.creationTime) || 'N/A'}</TableCell>
                    <TableCell>
                       <Button variant="link" size="sm" className="p-0 h-auto" disabled={!firebaseActive}>
                            Edit
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {firebaseActive ? 'No users found.' : 'User data unavailable.'}
                 </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* <Button className="mt-4" disabled={!firebaseActive}>Add New User</Button> */}
        </CardContent>
      </Card>

      {/* Audit Log Card */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5"/> System Audit Logs</CardTitle>
                <CardDescription>Recent activity logs for monitoring and compliance.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {showSkeleton ? (
                             Array.from({ length: 5 }).map((_, index) => (
                                <TableRow key={index}>
                                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                </TableRow>
                             ))
                        ) : firebaseActive && auditLogs.length > 0 ? ( // Audit logs are currently simulated, so check firebaseActive for consistency
                            auditLogs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="text-xs">{formatDateTime(log.timestamp)}</TableCell>
                                    <TableCell className="text-xs">{log.userEmail || log.userId}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="text-xs">{log.action}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{log.details || '-'}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                           <TableRow>
                               <TableCell colSpan={4} className="text-center text-muted-foreground">
                                {firebaseActive ? 'No audit logs available.' : 'Audit logs unavailable.'}
                               </TableCell>
                           </TableRow>
                        )}
                    </TableBody>
                </Table>
                 {/* TODO: Add pagination or date filtering for logs */}
            </CardContent>
        </Card>

       {/* Placeholder for System Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>System Analytics</CardTitle>
           <CardDescription>Overview of system usage (Placeholder).</CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-muted-foreground">Analytics charts and data will be displayed here.</p>
            {/* Add charting components later */}
        </CardContent>
      </Card>

       {/* Placeholder for Compliance Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Reports</CardTitle>
           <CardDescription>Generate compliance reports (Placeholder).</CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-muted-foreground">Functionality to generate HIPAA compliance reports will be added here.</p>
           {/* <Button disabled={!firebaseActive}>Generate Report</Button> */}
        </CardContent>
      </Card>
    </div>
  );
}
