
import ProfileDisplay from '@/components/profile-display';
import { getSession, type UserSession } from '@/app/actions/authActions';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default async function ProfilePage() {
  let session: UserSession | null = null;
  let sessionError: string | null = null;
  let isLoadingSession = true;

  try {
    session = await getSession();
  } catch (error) {
    console.error("Error getting session in ProfilePage:", error);
    sessionError = "Failed to retrieve session information.";
  } finally {
    isLoadingSession = false;
  }

  if (isLoadingSession) {
    return <ProfilePageSkeleton message="Verifying session..." />;
  }
  
  if (sessionError) {
    return (
       <main className="flex-grow p-4 md:p-6 lg:p-8 bg-secondary flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Session Error</AlertTitle>
          <AlertDescription>{sessionError}</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="flex-grow p-4 md:p-6 lg:p-8 bg-secondary">
      <Suspense fallback={<ProfilePageSkeleton />}>
        <ProfileDisplay userId={session.userId} />
      </Suspense>
    </main>
  );
}

function ProfilePageSkeleton({ message }: { message?: string }) {
  return (
    <div className="max-w-3xl mx-auto space-y-8 flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]"> {/* Adjust min-h as needed */}
       {message && (
        <div className="flex items-center text-lg text-foreground mb-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {message}
        </div>
      )}
      <div className="flex items-center gap-6 w-full">
        <Skeleton className="h-28 w-28 rounded-full" />
        <div className="space-y-3 flex-1">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
      <Card className="w-full">
        <CardHeader><Skeleton className="h-6 w-1/3 mb-2" /></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-full" /></div>
          <div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-full" /></div>
          <div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-full" /></div>
        </CardContent>
      </Card>
      <Card className="w-full">
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
