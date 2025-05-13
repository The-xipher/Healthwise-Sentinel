
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loginAction } from '@/app/actions/authActions';
import { Loader2, LogIn, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('email', data.email);
    formData.append('password', data.password);

    try {
      // loginAction will now handle the redirect internally on success.
      // If it returns, it means an error occurred before redirecting.
      const result = await loginAction(formData);

      if (!result.success) { // This block will only be hit if loginAction returns (i.e. on error)
        setError(result.message);
        toast({
          title: "Login Failed",
          description: result.message,
          variant: "destructive",
        });
      }
      // On success, loginAction calls redirect() and this part of the code is not reached.
      // Next.js handles the page transition.
    } catch (caughtError: any) {
      // Server actions that redirect throw a special error that Next.js handles.
      // We should not treat NEXT_REDIRECT as a typical error.
      if (caughtError.digest?.startsWith('NEXT_REDIRECT')) {
        // This is expected on successful redirect, do nothing or rethrow if needed.
        // Typically, Next.js handles this before it even reaches here in the client component.
        // If it does reach here, rethrowing ensures Next.js continues its process.
        throw caughtError;
      }
      console.error('LoginForm onSubmit error:', caughtError);
      const errorMessage = caughtError.message || 'An unexpected error occurred.';
      setError(errorMessage);
      toast({
        title: "Login Error",
        description: "An unexpected error occurred. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <Card className="w-full max-w-md shadow-2xl rounded-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2">
           <LogIn className="h-7 w-7 text-primary" />
          HealthWise Hub Login
        </CardTitle>
        <CardDescription>Access your personalized health dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Login Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...form.register('email')}
              disabled={isLoading}
              className="text-base py-3"
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...form.register('password')}
                disabled={isLoading}
                className="text-base py-3 pr-10" // Add pr-10 for icon spacing
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                onClick={togglePasswordVisibility}
                disabled={isLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </div>
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full text-lg py-6" disabled={isLoading} size="lg">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </CardContent>
       <CardFooter className="text-center text-xs text-muted-foreground">
        <p>Use seeded credentials: e.g., patient.zero@healthwise.com / password123</p>
      </CardFooter>
    </Card>
  );
}
