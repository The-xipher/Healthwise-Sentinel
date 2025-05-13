
'use client';

import * as React from 'react';
// useRouter removed as redirect is handled by server action
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
  // const router = useRouter(); // No longer needed for client-side redirect on success
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
      // loginAction will either redirect (throws NEXT_REDIRECT which is handled by Next.js)
      // or return an error object if login fails.
      const result = await loginAction(formData);

      // This part is reached ONLY if loginAction did NOT redirect (i.e., it returned an error).
      if (result && !result.success) {
        setError(result.message);
        toast({
          title: "Login Failed",
          description: result.message,
          variant: "destructive",
        });
      }
      // Successful login now results in a server-side redirect from loginAction.
      // Client-side router.push and success toast are no longer initiated here.
    } catch (caughtError: any) {
      // This catch block handles errors thrown by loginAction that are NOT NEXT_REDIRECT,
      // or network errors before the action completes.
      // NEXT_REDIRECT errors are handled by Next.js itself to perform navigation.
      if (caughtError.digest?.startsWith('NEXT_REDIRECT')) {
        // This is an expected signal for redirection, Next.js handles it.
        // Usually, no client-side action is needed.
      } else {
        // Handle other types of errors (e.g., network issues, unhandled server exceptions)
        const errorMessage = caughtError.message || 'An unexpected error occurred.';
        setError(errorMessage);
        toast({
          title: "Login Error",
          description: "An unexpected error occurred. Please check your connection and try again.",
          variant: "destructive",
        });
      }
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
