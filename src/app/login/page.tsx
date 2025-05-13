
import LoginForm from '@/components/login-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <div className="flex items-center justify-center min-h-screen bg-secondary p-4">
        <LoginForm />
      </div>
    </Suspense>
  );
}

function LoginPageSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-xl shadow-2xl">
        <div className="text-center">
          <Skeleton className="h-8 w-3/4 mx-auto mb-2" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
