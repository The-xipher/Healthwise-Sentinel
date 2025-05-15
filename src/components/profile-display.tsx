
'use client';

import * as React from 'react';
import { fetchUserProfile, updateUserProfileAction, type UserProfileData, type UserProfileUpdateData } from '@/app/actions/userActions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, UserCircle, Briefcase, Activity, Shield, CalendarDays, Clock, Phone, Mail, Edit, Save, XCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface ProfileDisplayProps {
  userId: string;
}

const profileUpdateSchema = z.object({
  displayName: z.string().min(3, "Display name must be at least 3 characters long.").optional(),
  contactEmail: z.string().email("Invalid contact email address.").optional().or(z.literal('')),
  emergencyContactNumber: z.string().optional(),
  emergencyContactEmail: z.string().email("Invalid emergency contact email.").optional().or(z.literal('')),
  // Role specific - these are optional and might not always be editable depending on UX choices
  specialty: z.string().optional(), // For doctors
  medicalHistory: z.string().optional(), // For patients
});

type ProfileUpdateFormValues = z.infer<typeof profileUpdateSchema>;


function ProfileDisplayLoadingSkeleton() {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-6">
          <Skeleton className="h-28 w-28 rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3 mb-2" /></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-full" /></div>
            <div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-full" /></div>
            <div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-full" /></div>
            <div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-full" /></div> 
            <div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-full" /></div> 
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3 mb-2" /></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-full" /></div>
            <div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-full" /></div>
            <div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /></div>
          </CardContent>
        </Card>
      </div>
    );
  }

export default function ProfileDisplay({ userId }: ProfileDisplayProps) {
  const [profile, setProfile] = React.useState<UserProfileData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();

  const form = useForm<ProfileUpdateFormValues>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {},
  });

  const { register, handleSubmit, reset, formState: { errors } } = form;


  React.useEffect(() => {
    async function loadProfile() {
      if (!userId) {
        setError("User ID is missing.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const result = await fetchUserProfile(userId);
      if (result.error) {
        setError(result.error);
      } else if (result.profile) {
        setProfile(result.profile);
        reset({ // Initialize form with fetched profile data
          displayName: result.profile.displayName || '',
          contactEmail: result.profile.email || '', // Profile.email is contact email
          emergencyContactNumber: result.profile.emergencyContactNumber || '',
          emergencyContactEmail: result.profile.emergencyContactEmail || '',
          specialty: result.profile.specialty || '',
          medicalHistory: result.profile.medicalHistory || '',
        });
      } else {
        setError("Profile data not found.");
      }
      setLoading(false);
    }
    loadProfile();
  }, [userId, reset]);

  const handleEditToggle = () => {
    if (isEditing && profile) { // If canceling edit, reset form to original profile data
      reset({
        displayName: profile.displayName || '',
        contactEmail: profile.email || '',
        emergencyContactNumber: profile.emergencyContactNumber || '',
        emergencyContactEmail: profile.emergencyContactEmail || '',
        specialty: profile.specialty || '',
        medicalHistory: profile.medicalHistory || '',
      });
    }
    setIsEditing(!isEditing);
  };

  const onProfileUpdateSubmit = async (data: ProfileUpdateFormValues) => {
    if (!profile) return;
    setIsSaving(true);

    const updatePayload: UserProfileUpdateData = {
      displayName: data.displayName !== profile.displayName ? data.displayName : undefined,
      contactEmail: data.contactEmail !== profile.email ? data.contactEmail : undefined,
      emergencyContactNumber: data.emergencyContactNumber !== profile.emergencyContactNumber ? data.emergencyContactNumber : undefined,
      emergencyContactEmail: data.emergencyContactEmail !== profile.emergencyContactEmail ? data.emergencyContactEmail : undefined,
    };
    if (profile.role === 'doctor' && data.specialty !== profile.specialty) {
      updatePayload.specialty = data.specialty;
    }
    if (profile.role === 'patient' && data.medicalHistory !== profile.medicalHistory) {
      updatePayload.medicalHistory = data.medicalHistory;
    }
    
    // Filter out undefined fields to only send actual changes
    const changes = Object.fromEntries(Object.entries(updatePayload).filter(([_, v]) => v !== undefined));

    if (Object.keys(changes).length === 0) {
      toast({ title: "No Changes", description: "No information was changed.", variant: "default" });
      setIsEditing(false);
      setIsSaving(false);
      return;
    }

    try {
      const result = await updateUserProfileAction(userId, changes);
      if (result.success && result.updatedProfile) {
        setProfile(result.updatedProfile);
        reset(result.updatedProfile); // Update form defaults with new saved data
        setIsEditing(false);
        toast({ title: "Profile Updated", description: result.message, variant: "default" });
      } else {
        toast({ title: "Update Failed", description: result.message || result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: "An unexpected error occurred: " + err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string | undefined): string => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + (names.length > 1 ? names[names.length - 1][0] : '')).toUpperCase();
  };

  const formatDate = (dateInput: string | Date | undefined) => {
    if (!dateInput) return 'N/A';
    const date = new Date(dateInput);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

   const formatDateTime = (dateInput: string | Date | undefined) => {
    if (!dateInput) return 'N/A';
    const date = new Date(dateInput);
    return date.toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };


  if (loading) {
    return <ProfileDisplayLoadingSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Profile</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!profile) {
    return (
      <Alert className="max-w-lg mx-auto">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Profile Not Found</AlertTitle>
        <AlertDescription>User profile data could not be loaded. Please try again later.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-card rounded-lg shadow-lg relative">
        <Avatar className="h-32 w-32 border-4 border-primary shadow-md">
          <AvatarImage src={profile.photoURL || undefined} alt={profile.displayName} data-ai-hint="profile person" />
          <AvatarFallback className="text-5xl bg-muted text-foreground">{getInitials(profile.displayName)}</AvatarFallback>
        </Avatar>
        <div className="text-center sm:text-left">
          {isEditing ? (
            <Input {...register("displayName")} defaultValue={profile.displayName} className="text-3xl md:text-4xl font-bold mb-1" />
          ) : (
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{profile.displayName}</h1>
          )}
          {errors.displayName && <p className="text-xs text-destructive">{errors.displayName.message}</p>}
          
          <p className="text-md md:text-lg text-muted-foreground">{profile.loginEmail || profile.email}</p>
          <Badge variant="secondary" className="mt-2 text-sm capitalize py-1 px-3">{profile.role}</Badge>
        </div>
        <Button onClick={handleEditToggle} variant="ghost" size="icon" className="absolute top-4 right-4">
          {isEditing ? <XCircle className="h-6 w-6" /> : <Edit className="h-5 w-5" />}
          <span className="sr-only">{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
        </Button>
      </div>

      <form onSubmit={handleSubmit(onProfileUpdateSubmit)}>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><UserCircle className="h-6 w-6 text-primary" /> Account Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm p-6">
            <div>
              <Label className="font-semibold text-foreground text-base">User ID:</Label>
              <p className="text-muted-foreground break-all">{profile.id}</p>
            </div>
            <div>
              <Label className="font-semibold text-foreground text-base flex items-center gap-1"><CalendarDays className="h-4 w-4"/>Member Since:</Label>
              <p className="text-muted-foreground">{formatDate(profile.creationTime)}</p>
            </div>
            <div>
              <Label className="font-semibold text-foreground text-base flex items-center gap-1"><Clock className="h-4 w-4"/>Last Sign In:</Label>
              <p className="text-muted-foreground">{formatDateTime(profile.lastSignInTime)}</p>
            </div>
             <div>
              <Label htmlFor="contactEmail" className="font-semibold text-foreground text-base flex items-center gap-1"><Mail className="h-4 w-4"/>Contact Email:</Label>
              {isEditing ? (
                <>
                  <Input id="contactEmail" {...register("contactEmail")} type="email" defaultValue={profile.email} />
                  {errors.contactEmail && <p className="text-xs text-destructive">{errors.contactEmail.message}</p>}
                </>
              ) : (
                <p className="text-muted-foreground">{profile.email || 'N/A'}</p>
              )}
            </div>
             <div>
              <Label htmlFor="emergencyContactNumber" className="font-semibold text-foreground text-base flex items-center gap-1"><Phone className="h-4 w-4"/>Emergency Contact Phone:</Label>
              {isEditing ? (
                <>
                  <Input id="emergencyContactNumber" {...register("emergencyContactNumber")} defaultValue={profile.emergencyContactNumber || ''} />
                   {errors.emergencyContactNumber && <p className="text-xs text-destructive">{errors.emergencyContactNumber.message}</p>}
                </>
              ) : (
                <p className="text-muted-foreground">{profile.emergencyContactNumber || 'N/A'}</p>
              )}
            </div>
             <div>
              <Label htmlFor="emergencyContactEmail" className="font-semibold text-foreground text-base flex items-center gap-1"><Mail className="h-4 w-4 text-red-500"/>Emergency Contact Email:</Label>
              {isEditing ? (
                <>
                  <Input id="emergencyContactEmail" {...register("emergencyContactEmail")} type="email" defaultValue={profile.emergencyContactEmail || ''} />
                  {errors.emergencyContactEmail && <p className="text-xs text-destructive">{errors.emergencyContactEmail.message}</p>}
                </>
              ) : (
                <p className="text-muted-foreground">{profile.emergencyContactEmail || 'N/A'}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {profile.role === 'patient' && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Activity className="h-6 w-6 text-primary" /> Health Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6 text-sm">
              <div>
                <Label className="font-semibold text-foreground text-base">Assigned Doctor:</Label>
                <p className="text-muted-foreground">{profile.assignedDoctorName || 'Not Assigned'}</p>
              </div>
              <div>
                <Label className="font-semibold text-foreground text-base">Readmission Risk:</Label>
                <p className="text-muted-foreground capitalize">{profile.readmissionRisk || 'N/A'}</p>
              </div>
              <div>
                <Label htmlFor="medicalHistory" className="font-semibold text-foreground text-base">Medical History Overview:</Label>
                {isEditing ? (
                  <>
                    <Textarea id="medicalHistory" {...register("medicalHistory")} defaultValue={profile.medicalHistory || ''} rows={4} />
                    {errors.medicalHistory && <p className="text-xs text-destructive">{errors.medicalHistory.message}</p>}
                  </>
                ) : (
                  <p className="text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{profile.medicalHistory || 'No history provided.'}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {profile.role === 'doctor' && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Briefcase className="h-6 w-6 text-primary" /> Professional Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-sm space-y-6">
              <div>
                <Label htmlFor="specialty" className="font-semibold text-foreground text-base">Specialty:</Label>
                {isEditing ? (
                    <>
                      <Input id="specialty" {...register("specialty")} defaultValue={profile.specialty || ''} />
                      {errors.specialty && <p className="text-xs text-destructive">{errors.specialty.message}</p>}
                    </>
                ) : (
                  <p className="text-muted-foreground">{profile.specialty || 'Not Specified'}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {profile.role === 'admin' && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Shield className="h-6 w-6 text-primary" /> Admin Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-sm">
              <p className="text-muted-foreground">This user has administrative privileges and can oversee system operations.</p>
            </CardContent>
          </Card>
        )}
        
        {isEditing && (
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="outline" onClick={handleEditToggle} disabled={isSaving}>
              <XCircle className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
