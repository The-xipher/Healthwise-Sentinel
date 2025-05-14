
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
import { Users, Activity, ShieldCheck, AlertTriangle, UserPlus, Loader2 } from 'lucide-react';
import { fetchAdminDashboardData, createUserAction, type AdminUser } from '@/app/actions/adminActions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Textarea } from './ui/textarea';
import { cn } from "@/lib/utils"

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

const addUserSchema = z.object({
  displayName: z.string().min(3, "Display name must be at least 3 characters."),
  email: z.string().email("Invalid email address."),
  role: z.enum(['patient', 'doctor', 'admin'], { required_error: "Role is required." }),
  specialty: z.string().optional(), // Optional, can be made required for doctors later
  assignedDoctorId: z.string().optional(), // Optional for patients
  medicalHistory: z.string().optional(), // Optional for patients
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

export default function AdminDashboard({ adminUserId }: AdminDashboardProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dbAvailable, setDbAvailable] = useState<boolean>(true);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const { toast } = useToast();

  const { register, handleSubmit, control, formState: { errors }, reset, watch } = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      role: undefined,
    }
  });
  const selectedRole = watch("role");

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

  }, [adminUserId]);

  const onAddUserSubmit = async (data: AddUserFormValues) => {
    setAddingUser(true);
    const formData = new FormData();
    formData.append('displayName', data.displayName);
    formData.append('email', data.email);
    formData.append('role', data.role);
    if (data.role === 'doctor' && data.specialty) formData.append('specialty', data.specialty);
    if (data.role === 'patient' && data.assignedDoctorId) formData.append('assignedDoctorId', data.assignedDoctorId);
    if (data.role === 'patient' && data.medicalHistory) formData.append('medicalHistory', data.medicalHistory);


    try {
      const result = await createUserAction(formData);
      if (result.success) {
        toast({ title: "User Created", description: result.message, variant: "default" });
        if (result.user) {
          setUsers(prev => [...prev, result.user!]);
        }
        setIsAddUserDialogOpen(false);
        reset();
      } else {
        toast({ title: "Creation Failed", description: result.message || result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: "An unexpected error occurred: " + err.message, variant: "destructive" });
    } finally {
      setAddingUser(false);
    }
  };

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
    if (!date) return 'N/A';
    return date.toLocaleString();
  };
  
  const doctorOptions = users.filter(u => u.role === 'doctor').map(doc => ({
    value: doc.id,
    label: doc.displayName || `Doctor (${doc.id.substring(0,6)})`
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-7 w-7" /> Admin Portal
        </h1>
        <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default" disabled={!dbAvailable}>
              <UserPlus className="mr-2 h-4 w-4" /> Add New User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new patient, doctor, or admin account. An email with a temporary password will be sent.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onAddUserSubmit)} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="displayName" className="text-right">Display Name</Label>
                <Input id="displayName" {...register("displayName")} className="col-span-3" />
                {errors.displayName && <p className="col-span-4 text-xs text-destructive text-right">{errors.displayName.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Login Email</Label>
                <Input id="email" type="email" {...register("email")} className="col-span-3" />
                 {errors.email && <p className="col-span-4 text-xs text-destructive text-right">{errors.email.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">Role</Label>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="patient">Patient</SelectItem>
                        <SelectItem value="doctor">Doctor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                 {errors.role && <p className="col-span-4 text-xs text-destructive text-right">{errors.role.message}</p>}
              </div>

              {selectedRole === 'doctor' && (
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="specialty" className="text-right">Specialty</Label>
                    <Input id="specialty" {...register("specialty")} className="col-span-3" placeholder="e.g., Cardiology"/>
                    {errors.specialty && <p className="col-span-4 text-xs text-destructive text-right">{errors.specialty.message}</p>}
                </div>
              )}

              {selectedRole === 'patient' && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="assignedDoctorId" className="text-right">Assigned Doctor</Label>
                     <Controller
                        name="assignedDoctorId"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select assigned doctor (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                {doctorOptions.length > 0 ? doctorOptions.map(doc => (
                                <SelectItem key={doc.value} value={doc.value}>{doc.label}</SelectItem>
                                )) : <p className="p-2 text-sm text-muted-foreground">No doctors available</p>}
                            </SelectContent>
                            </Select>
                        )}
                        />
                    {errors.assignedDoctorId && <p className="col-span-4 text-xs text-destructive text-right">{errors.assignedDoctorId.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                     <Label htmlFor="medicalHistory" className="text-right pt-2">Medical History</Label>
                     <Textarea id="medicalHistory" {...register("medicalHistory")} className="col-span-3" placeholder="Brief medical history (optional)"/>
                     {errors.medicalHistory && <p className="col-span-4 text-xs text-destructive text-right">{errors.medicalHistory.message}</p>}
                  </div>
                </>
              )}


              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={addingUser}>
                  {addingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create User
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      

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
