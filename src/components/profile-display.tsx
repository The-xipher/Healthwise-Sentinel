
'use client';

import * as React from 'react';
import { fetchUserProfile, type UserProfileData } from '@/app/actions/userActions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, UserCircle, Briefcase, Activity, Shield, CalendarDays, Clock } from 'lucide-react';

interface ProfileDisplayProps {
  userId: string;
}

// Inner Skeleton component for when loading within ProfileDisplay
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
      } else {
        setProfile(result.profile || null);
      }
      setLoading(false);
    }
    loadProfile();
  }, [userId]);

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
      <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-card rounded-lg shadow-lg">
        <Avatar className="h-32 w-32 border-4 border-primary shadow-md">
          <AvatarImage src={profile.photoURL || undefined} alt={profile.displayName} data-ai-hint="profile person" />
          <AvatarFallback className="text-5xl bg-muted text-foreground">{getInitials(profile.displayName)}</AvatarFallback>
        </Avatar>
        <div className="text-center sm:text-left">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">{profile.displayName}</h1>
          <p className="text-md md:text-lg text-muted-foreground">{profile.email}</p>
          <Badge variant="secondary" className="mt-2 text-sm capitalize py-1 px-3">{profile.role}</Badge>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl"><UserCircle className="h-6 w-6 text-primary" /> Account Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 text-sm p-6">
          <div>
            <p className="font-semibold text-foreground text-base">User ID:</p>
            <p className="text-muted-foreground break-all">{profile.id}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground text-base flex items-center gap-1"><CalendarDays className="h-4 w-4"/>Member Since:</p>
            <p className="text-muted-foreground">{formatDate(profile.creationTime)}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground text-base flex items-center gap-1"><Clock className="h-4 w-4"/>Last Sign In:</p>
            <p className="text-muted-foreground">{formatDateTime(profile.lastSignInTime)}</p>
          </div>
        </CardContent>
      </Card>

      {profile.role === 'patient' && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><Activity className="h-6 w-6 text-primary" /> Health Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6 text-sm">
            <div>
              <p className="font-semibold text-foreground text-base">Assigned Doctor:</p>
              <p className="text-muted-foreground">{profile.assignedDoctorName || 'Not Assigned'}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground text-base">Readmission Risk:</p>
              <p className="text-muted-foreground capitalize">{profile.readmissionRisk || 'N/A'}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground text-base">Medical History Overview:</p>
              <p className="text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{profile.medicalHistory || 'No history provided.'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {profile.role === 'doctor' && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><Briefcase className="h-6 w-6 text-primary" /> Professional Information</CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-sm">
            <div>
              <p className="font-semibold text-foreground text-base">Specialty:</p>
              <p className="text-muted-foreground">{profile.specialty || 'Not Specified'}</p>
            </div>
            {/* Add more doctor-specific fields if available */}
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
            {/* Add more admin-specific fields if available */}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
