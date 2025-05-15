
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Users, Activity, ShieldCheck, AlertTriangle, UserPlus, Loader2, Trash2, Edit3, Siren } from 'lucide-react';
import { 
  fetchAdminDashboardData, 
  createUserAction, 
  type AdminUser, 
  deleteUserAction, 
  simulatePatientAlertAction,
  updateUserByAdminAction 
} from '@/app/actions/adminActions';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Textarea } from './ui/textarea';
import { cn } from "@/lib/utils";


interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userEmail?: string;
  action: string;
  details?: string;
}

interface AdminDashboardProps {
  adminUserId: string; 
}

const userFormSchemaBase = {
  displayName: z.string().min(3, "Display name must be at least 3 characters."),
  contactEmail: z.string().email("Invalid contact email address.").optional().or(z.literal('')),
  specialty: z.string().optional(), 
  assignedDoctorId: z.string().optional(),
  medicalHistory: z.string().optional(),
  emergencyContactNumber: z.string().optional(),
  emergencyContactEmail: z.string().email("Invalid emergency contact email.").optional().or(z.literal('')),
};

const addUserSchema = z.object({
  ...userFormSchemaBase,
  loginEmail: z.string().email("Invalid login email address."),
  role: z.enum(['patient', 'doctor', 'admin'], { required_error: "Role is required." }),
});
type AddUserFormValues = z.infer<typeof addUserSchema>;

const editUserSchema = z.object({
   ...userFormSchemaBase,
   // Role and LoginEmail are not typically editable in this context by admin to simplify things
});
type EditUserFormValues = z.infer<typeof editUserSchema>;


export default function AdminDashboard({ adminUserId }: AdminDashboardProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dbAvailable, setDbAvailable] = useState<boolean>(true);
  
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [addingUser, setAddingUser] = useState(false);

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);

  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [userToAlert, setUserToAlert] = useState<AdminUser | null>(null);
  const [alertSimulationMessage, setAlertSimulationMessage] = useState('');
  const [simulatingAlert, setSimulatingAlert] = useState(false);
  const { toast } = useToast();

  const addUserForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      role: undefined,
      contactEmail: '',
      emergencyContactEmail: ''
    }
  });
  const selectedRoleForAdd = addUserForm.watch("role");

  const editUserForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {},
  });


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

  useEffect(() => {
    if (editingUser) {
      editUserForm.reset({
        displayName: editingUser.displayName || '',
        contactEmail: editingUser.email || '',
        specialty: editingUser.role === 'doctor' ? editingUser.specialty || '' : undefined,
        assignedDoctorId: editingUser.role === 'patient' ? editingUser.assignedDoctorId || '' : undefined,
        medicalHistory: editingUser.role === 'patient' ? editingUser.medicalHistory || '' : undefined,
        emergencyContactNumber: editingUser.role === 'patient' ? editingUser.emergencyContactNumber || '' : undefined,
        emergencyContactEmail: editingUser.role === 'patient' ? editingUser.emergencyContactEmail || '' : undefined,
      });
    }
  }, [editingUser, editUserForm]);

  const onAddUserSubmit = async (data: AddUserFormValues) => {
    setAddingUser(true);
    const formData = new FormData();
    formData.append('displayName', data.displayName);
    formData.append('loginEmail', data.loginEmail);
    if(data.contactEmail) formData.append('contactEmail', data.contactEmail);
    formData.append('role', data.role);
    if (data.role === 'doctor' && data.specialty) formData.append('specialty', data.specialty);
    if (data.role === 'patient') {
        if (data.assignedDoctorId) formData.append('assignedDoctorId', data.assignedDoctorId);
        if (data.medicalHistory) formData.append('medicalHistory', data.medicalHistory);
        if (data.emergencyContactNumber) formData.append('emergencyContactNumber', data.emergencyContactNumber);
        if (data.emergencyContactEmail) formData.append('emergencyContactEmail', data.emergencyContactEmail);
    }


    try {
      const result = await createUserAction(formData);
      if (result.success) {
        toast({ title: "User Created", description: result.message, variant: "default" });
        if (result.user) {
          setUsers(prev => [...prev, result.user!].sort((a,b) => (a.displayName || '').localeCompare(b.displayName || '')));
        }
        setIsAddUserDialogOpen(false);
        addUserForm.reset();
      } else {
        toast({ title: "Creation Failed", description: result.message || result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: "An unexpected error occurred: " + err.message, variant: "destructive" });
    } finally {
      setAddingUser(false);
    }
  };

  const onEditUserSubmit = async (data: EditUserFormValues) => {
    if (!editingUser) return;
    setUpdatingUser(true);
    const formData = new FormData();
    
    // Only append changed values or values relevant to the role
    if (data.displayName && data.displayName !== editingUser.displayName) formData.append('displayName', data.displayName);
    if (data.contactEmail && data.contactEmail !== editingUser.email) formData.append('contactEmail', data.contactEmail);
    
    if (editingUser.role === 'doctor' && data.specialty !== editingUser.specialty) {
        formData.append('specialty', data.specialty || '');
    }
    if (editingUser.role === 'patient') {
        if (data.assignedDoctorId !== editingUser.assignedDoctorId) formData.append('assignedDoctorId', data.assignedDoctorId || '');
        if (data.medicalHistory !== editingUser.medicalHistory) formData.append('medicalHistory', data.medicalHistory || '');
        if (data.emergencyContactNumber !== editingUser.emergencyContactNumber) formData.append('emergencyContactNumber', data.emergencyContactNumber || '');
        if (data.emergencyContactEmail !== editingUser.emergencyContactEmail) formData.append('emergencyContactEmail', data.emergencyContactEmail || '');
    }
    
    // If formData has no entries, it means nothing changed that we track for edit.
    let hasChanges = false;
    for (const _ of formData.entries()) {
        hasChanges = true;
        break;
    }
    if (!hasChanges && data.displayName === editingUser.displayName && data.contactEmail === editingUser.email) {
         toast({ title: "No Changes", description: "No information was modified.", variant: "default" });
         setIsEditUserDialogOpen(false);
         setUpdatingUser(false);
         return;
    }


    try {
      const result = await updateUserByAdminAction(editingUser.id, formData);
      if (result.success) {
        toast({ title: "User Updated", description: result.message, variant: "default" });
        if (result.updatedUser) {
          setUsers(prev => prev.map(u => u.id === result.updatedUser!.id ? result.updatedUser! : u).sort((a,b) => (a.displayName || '').localeCompare(b.displayName || '')));
        }
        setIsEditUserDialogOpen(false);
        setEditingUser(null);
      } else {
        toast({ title: "Update Failed", description: result.message || result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: "An unexpected error occurred: " + err.message, variant: "destructive" });
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setLoadingUsers(true); 
    try {
      const result = await deleteUserAction(userToDelete.id);
      if (result.success) {
        toast({ title: "User Deleted", description: result.message, variant: "default" });
        setUsers(prevUsers => prevUsers.filter(user => user.id !== userToDelete.id));
      } else {
        toast({ title: "Deletion Failed", description: result.message || result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: "An unexpected error occurred during deletion: " + err.message, variant: "destructive" });
    } finally {
      setUserToDelete(null);
      setLoadingUsers(false);
    }
  };

  const handleSimulateAlert = async () => {
    if (!userToAlert) return;
    setSimulatingAlert(true);
    try {
      const result = await simulatePatientAlertAction(userToAlert.id, alertSimulationMessage || undefined);
      if (result.success) {
        toast({ title: "Alert Simulation Sent", description: result.message, variant: "default" });
      } else {
        toast({ title: "Alert Simulation Failed", description: result.message || result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error Simulating Alert", description: "An unexpected error occurred: " + err.message, variant: "destructive" });
    } finally {
      setUserToAlert(null);
      setAlertSimulationMessage('');
      setSimulatingAlert(false);
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
          <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new patient, doctor, or admin account. An email with a temporary password will be sent.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={addUserForm.handleSubmit(onAddUserSubmit)} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="add-displayName" className="text-right">Display Name*</Label>
                <Input id="add-displayName" {...addUserForm.register("displayName")} className="col-span-3" />
                {addUserForm.formState.errors.displayName && <p className="col-span-4 text-xs text-destructive text-right">{addUserForm.formState.errors.displayName.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="add-loginEmail" className="text-right">Login Email*</Label>
                <Input id="add-loginEmail" type="email" {...addUserForm.register("loginEmail")} className="col-span-3" />
                 {addUserForm.formState.errors.loginEmail && <p className="col-span-4 text-xs text-destructive text-right">{addUserForm.formState.errors.loginEmail.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="add-contactEmail" className="text-right">Contact Email</Label>
                <Input id="add-contactEmail" type="email" {...addUserForm.register("contactEmail")} className="col-span-3" placeholder="Optional, defaults to login email"/>
                 {addUserForm.formState.errors.contactEmail && <p className="col-span-4 text-xs text-destructive text-right">{addUserForm.formState.errors.contactEmail.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="add-role" className="text-right">Role*</Label>
                <Controller
                  name="role"
                  control={addUserForm.control}
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
                 {addUserForm.formState.errors.role && <p className="col-span-4 text-xs text-destructive text-right">{addUserForm.formState.errors.role.message}</p>}
              </div>

              {selectedRoleForAdd === 'doctor' && (
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="add-specialty" className="text-right">Specialty</Label>
                    <Input id="add-specialty" {...addUserForm.register("specialty")} className="col-span-3" placeholder="e.g., Cardiology"/>
                    {addUserForm.formState.errors.specialty && <p className="col-span-4 text-xs text-destructive text-right">{addUserForm.formState.errors.specialty.message}</p>}
                </div>
              )}

              {selectedRoleForAdd === 'patient' && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="add-assignedDoctorId" className="text-right">Assigned Doctor</Label>
                     <Controller
                        name="assignedDoctorId"
                        control={addUserForm.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || ''}>
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
                    {addUserForm.formState.errors.assignedDoctorId && <p className="col-span-4 text-xs text-destructive text-right">{addUserForm.formState.errors.assignedDoctorId.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                     <Label htmlFor="add-medicalHistory" className="text-right pt-2">Medical History</Label>
                     <Textarea id="add-medicalHistory" {...addUserForm.register("medicalHistory")} className="col-span-3" placeholder="Brief medical history (optional)"/>
                     {addUserForm.formState.errors.medicalHistory && <p className="col-span-4 text-xs text-destructive text-right">{addUserForm.formState.errors.medicalHistory.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="add-emergencyContactNumber" className="text-right">Emergency Phone</Label>
                    <Input id="add-emergencyContactNumber" {...addUserForm.register("emergencyContactNumber")} className="col-span-3" placeholder="Optional"/>
                    {addUserForm.formState.errors.emergencyContactNumber && <p className="col-span-4 text-xs text-destructive text-right">{addUserForm.formState.errors.emergencyContactNumber.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="add-emergencyContactEmail" className="text-right">Emergency Email</Label>
                    <Input id="add-emergencyContactEmail" type="email" {...addUserForm.register("emergencyContactEmail")} className="col-span-3" placeholder="Optional"/>
                    {addUserForm.formState.errors.emergencyContactEmail && <p className="col-span-4 text-xs text-destructive text-right">{addUserForm.formState.errors.emergencyContactEmail.message}</p>}
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

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={(open) => { if (!open) setEditingUser(null); setIsEditUserDialogOpen(open); }}>
        <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User: {editingUser?.displayName}</DialogTitle>
            <DialogDescription>
              Modify the user's details below. Role and Login Email cannot be changed here.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Login Email</Label>
                <Input value={editingUser.loginEmail || 'N/A'} className="col-span-3" disabled readOnly />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Role</Label>
                <Input value={editingUser.role || 'N/A'} className="col-span-3 capitalize" disabled readOnly />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-displayName" className="text-right">Display Name*</Label>
                <Input id="edit-displayName" {...editUserForm.register("displayName")} className="col-span-3" />
                {editUserForm.formState.errors.displayName && <p className="col-span-4 text-xs text-destructive text-right">{editUserForm.formState.errors.displayName.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-contactEmail" className="text-right">Contact Email</Label>
                <Input id="edit-contactEmail" type="email" {...editUserForm.register("contactEmail")} className="col-span-3" />
                {editUserForm.formState.errors.contactEmail && <p className="col-span-4 text-xs text-destructive text-right">{editUserForm.formState.errors.contactEmail.message}</p>}
              </div>
              
              {editingUser.role === 'doctor' && (
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-specialty" className="text-right">Specialty</Label>
                    <Input id="edit-specialty" {...editUserForm.register("specialty")} className="col-span-3" />
                    {editUserForm.formState.errors.specialty && <p className="col-span-4 text-xs text-destructive text-right">{editUserForm.formState.errors.specialty.message}</p>}
                </div>
              )}

              {editingUser.role === 'patient' && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-assignedDoctorId" className="text-right">Assigned Doctor</Label>
                     <Controller
                        name="assignedDoctorId"
                        control={editUserForm.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || ''} >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select assigned doctor" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {doctorOptions.map(doc => (
                                <SelectItem key={doc.value} value={doc.value}>{doc.label}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                        )}
                        />
                    {editUserForm.formState.errors.assignedDoctorId && <p className="col-span-4 text-xs text-destructive text-right">{editUserForm.formState.errors.assignedDoctorId.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                     <Label htmlFor="edit-medicalHistory" className="text-right pt-2">Medical History</Label>
                     <Textarea id="edit-medicalHistory" {...editUserForm.register("medicalHistory")} className="col-span-3"/>
                     {editUserForm.formState.errors.medicalHistory && <p className="col-span-4 text-xs text-destructive text-right">{editUserForm.formState.errors.medicalHistory.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-emergencyContactNumber" className="text-right">Emergency Phone</Label>
                    <Input id="edit-emergencyContactNumber" {...editUserForm.register("emergencyContactNumber")} className="col-span-3" />
                    {editUserForm.formState.errors.emergencyContactNumber && <p className="col-span-4 text-xs text-destructive text-right">{editUserForm.formState.errors.emergencyContactNumber.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-emergencyContactEmail" className="text-right">Emergency Email</Label>
                    <Input id="edit-emergencyContactEmail" type="email" {...editUserForm.register("emergencyContactEmail")} className="col-span-3" />
                    {editUserForm.formState.errors.emergencyContactEmail && <p className="col-span-4 text-xs text-destructive text-right">{editUserForm.formState.errors.emergencyContactEmail.message}</p>}
                  </div>
                </>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {setIsEditUserDialogOpen(false); setEditingUser(null);}}>Cancel</Button>
                <Button type="submit" disabled={updatingUser}>
                  {updatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>


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
                <TableHead>Login Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingUsers && !userToDelete ? ( 
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right space-x-1">
                        <Skeleton className="h-8 w-8 inline-block" />
                        <Skeleton className="h-8 w-8 inline-block" />
                        <Skeleton className="h-8 w-8 inline-block" />
                    </TableCell>
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
                    <TableCell>{u.loginEmail || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'admin' ? 'destructive' : u.role === 'doctor' ? 'secondary' : 'outline'} className="capitalize">
                        {u.role || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(u.creationTime) || 'N/A'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        disabled={!dbAvailable || updatingUser} 
                        onClick={() => { setEditingUser(u); setIsEditUserDialogOpen(true); }}
                        title="Edit User">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      {u.role === 'patient' && (
                           <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                              disabled={!dbAvailable || simulatingAlert}
                              onClick={() => setUserToAlert(u)}
                              title="Simulate Critical Alert for Patient"
                            >
                              <Siren className="h-4 w-4" />
                            </Button>
                      )}
                       <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={!dbAvailable || u.id === adminUserId || loadingUsers}
                          onClick={() => setUserToDelete(u)}
                          title={u.id === adminUserId ? "Cannot delete self" : "Delete User"}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account 
              for <span className="font-semibold">{userToDelete?.displayName} ({userToDelete?.role})</span> and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              className={cn(buttonVariants({variant: "destructive"}))}
              disabled={loadingUsers}
            >
              {loadingUsers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Simulate Patient Alert Dialog */}
      <AlertDialog open={!!userToAlert} onOpenChange={(open) => { if (!open) { setUserToAlert(null); setAlertSimulationMessage(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Simulate Critical Alert for {userToAlert?.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a test critical alert email to the patient's emergency contact (if set) and a notification to their assigned doctor. Use for testing purposes only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="alertMessage" className="text-right col-span-1">
                Message
              </Label>
              <Textarea
                id="alertMessage"
                value={alertSimulationMessage}
                onChange={(e) => setAlertSimulationMessage(e.target.value)}
                className="col-span-3"
                placeholder="Optional: Custom alert message (defaults to a test message)"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setUserToAlert(null); setAlertSimulationMessage(''); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSimulateAlert} 
              className={cn(buttonVariants({variant: "destructive"}))} 
              disabled={simulatingAlert}
            >
              {simulatingAlert ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Siren className="mr-2 h-4 w-4"/>}
              Send Test Alert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


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

