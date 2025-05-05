'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Activity, ShieldCheck } from 'lucide-react'; // Added icons

interface AdminDashboardProps {
  user: User; // Admin's user object
}

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


export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]); // State for logs
  const [loadingLogs, setLoadingLogs] = useState(true); // Loading state for logs
  const [error, setError] = useState<string | null>(null);

  // Fetch all users from Firestore 'users' collection
  useEffect(() => {
    setLoadingUsers(true);
    setError(null);
    const usersQuery = query(collection(db, 'users')); // Adjust if your collection name is different

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

    // Simulate fetching audit logs (replace with actual Firestore query)
    setLoadingLogs(true);
    const fetchLogs = async () => {
        // --- Replace with actual Firestore query ---
        // Example: const logsQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(20));
        // const unsubscribeLogs = onSnapshot(logsQuery, ...);
        // --- Simulation Starts ---
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
        const simulatedLogs: AuditLog[] = [
            { id: 'log1', timestamp: new Date(), userId: 'doctor_abc', userEmail: 'dr.smith@hospital.org', action: 'view_patient_data', details: 'Patient ID: patient_xyz' },
            { id: 'log2', timestamp: new Date(Date.now() - 60000 * 5), userId: 'patient_xyz', userEmail: 'patient@mail.com', action: 'symptom_report', details: 'Severity: moderate' },
            { id: 'log3', timestamp: new Date(Date.now() - 60000 * 10), userId: user.uid, userEmail: user.email || undefined, action: 'login', details: 'Admin logged in' },
            { id: 'log4', timestamp: new Date(Date.now() - 60000 * 15), userId: 'doctor_abc', userEmail: 'dr.smith@hospital.org', action: 'approve_suggestion', details: 'Suggestion ID: sug_123' },
        ];
        setAuditLogs(simulatedLogs);
        setLoadingLogs(false);
        // --- Simulation Ends ---
    };
    fetchLogs();


    return () => {
        unsubscribeUsers();
        // unsubscribeLogs(); // Uncomment when using real Firestore listener
    }
  }, [user.uid, user.email]); // Depend on admin user info if needed for logs


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


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
        <ShieldCheck className="h-7 w-7"/> Admin Portal
      </h1>

      {error && (
        <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800" role="alert">
          <span className="font-medium">Error:</span> {error}
        </div>
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
                <TableHead>Actions</TableHead> {/* Placeholder for actions */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingUsers ? (
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
              ) : users.length > 0 ? (
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
                       {/* Add Edit/Delete buttons here - requires implementation */}
                       <button className="text-primary hover:underline text-sm">Edit</button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">No users found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* TODO: Add functionality for Adding/Editing Users */}
           {/* <Button className="mt-4">Add New User</Button> */}
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
                        {loadingLogs ? (
                             Array.from({ length: 5 }).map((_, index) => (
                                <TableRow key={index}>
                                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                </TableRow>
                             ))
                        ) : auditLogs.length > 0 ? (
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
                               <TableCell colSpan={4} className="text-center text-muted-foreground">No audit logs available.</TableCell>
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
           {/* <Button>Generate Report</Button> */}
        </CardContent>
      </Card>
    </div>
  );
}
