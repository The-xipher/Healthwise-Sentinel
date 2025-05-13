
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Users, Activity, ShieldCheck, AlertTriangle } from 'lucide-react';
import { fetchAdminDashboardData, AdminUser } from '@/app/actions/adminActions';

interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userEmail?: string;
  action: string;
  details?: string;
}

interface AdminDashboardProps {
  adminUserId: string; // Logged-in admin's ID
}

export default function AdminDashboard({ adminUserId }: AdminDashboardProps) {
  const [users, setUsers = useState([]);
  const [loadingUsers, setLoadingUsers = useState(true);
  const [auditLogs, setAuditLogs = useState([]);
  const [loadingLogs, setLoadingLogs = useState(true);
  const [error, setError = useState(null);
  const [dbAvailable, setDbAvailable = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoadingUsers(true);
      setError(null);
      try {
        const result = await fetchAdminDashboardData();
        if (result.error) {
          setError(result.error);
          setDbAvailable(false);
          setUsers([]);
        } else {
          setUsers(result.users || []);
          setDbAvailable(true);
        }
      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred while fetching admin data.');
        setDbAvailable(false);
        setUsers([]);
        console.error(e);
      } finally {
        setLoadingUsers(false);
      }
    }

    loadData();

    setLoadingLogs(true);
    const fetchLogs = async () => {
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      // Simulate fetching audit logs, using the logged-in admin's ID if needed for context
      const simulatedLogs: AuditLog[] = [
        { id: 'log1', timestamp: new Date(), userId: 'doctor_example_id', userEmail: 'dr.smith@example.com', action: 'view_patient_data', details: 'Patient ID: patient_example_id' },
        { id: 'log2', timestamp: new Date(Date.now() - 60000 * 5), userId: 'patient_example_id', userEmail: 'patient@example.com', action: 'symptom_report', details: 'Severity: moderate' },
        { id: 'log3', timestamp: new Date(Date.now() - 60000 * 10), userId: adminUserId, userEmail: 'admin@healthwise.com', action: 'login', details: `Admin (${adminUserId}) logged in (Simulated)` },
        { id: 'log4', timestamp: new Date(Date.now() - 60000 * 15), userId: 'doctor_example_id', userEmail: 'dr.smith@example.com', action: 'approve_suggestion', details: 'Suggestion ID: sug_123' },
      ];
      setAuditLogs(simulatedLogs);
      setLoadingLogs(false);
    };
    fetchLogs();

  }, [adminUserId]); // Re-fetch audit logs if adminUserId changes (though not typical for this component)

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  };

  const formatDate = (dateInput: string | Date | undefined): string => {
    if (!dateInput) return 'N/A';
    try {
      return new Date(dateInput).toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  const formatDateTime = (date: Date | undefined): string => {
    if (!date) return date.toLocaleString();
  };
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
        <ShieldCheck className="h-7 w-7" /> Admin Portal
      </h1>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!dbAvailable && !loadingUsers && !error && (
        <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle>Database Disconnected</AlertTitle>
          <AlertDescription>
            Database features are currently offline. User and log data cannot be loaded or managed.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> User Management</CardTitle>
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
              {loadingUsers ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : dbAvailable && users.length > 0 ? (
                users.map((u) => (
                  <TableRow key={u.id || u._id.toString()}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.photoURL || undefined} alt={u.displayName || 'User'} data-ai-hint="profile person"/>
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
                      <Button variant="link" size="sm" className="p-0 h-auto" disabled={!dbAvailable}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {dbAvailable ? 'No users found.' : 'User data unavailable due to connection issues.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> System Audit Logs</CardTitle>
          <CardDescription>Recent activity logs for monitoring and compliance (Simulated).</CardDescription>
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
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No audit logs available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Analytics</CardTitle>
          <CardDescription>Overview of system usage (Placeholder).</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Analytics charts and data will be displayed here.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Reports</CardTitle>
          <CardDescription>Generate compliance reports (Placeholder).</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Functionality to generate HIPAA compliance reports will be added here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
