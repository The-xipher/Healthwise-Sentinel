
import ProfileDisplay from '@/components/profile-display';
import { getSession } from '@/app/actions/authActions';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default async function ProfilePage() {
  const session = await getSession();
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

function ProfilePageSkeleton() {
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
