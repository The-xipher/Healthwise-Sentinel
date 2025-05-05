'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { app, isFirebaseInitialized, getFirebaseConfigError } from '@/lib/firebase'; // Import helpers
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Mail, KeyRound } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

// Inline SVG for Google Icon
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.712,35.619,44,29.57,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);


export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Get auth instance only if Firebase is ready
  const auth = firebaseReady ? getAuth(app!) : null;

  useEffect(() => {
    const ready = isFirebaseInitialized();
    setFirebaseReady(ready);
    if (!ready) {
      setConfigError(getFirebaseConfigError() || "Firebase is not configured correctly. Please check the console and environment variables.");
    } else {
      setConfigError(null); // Clear config error if Firebase is ready now
    }
  }, []); // Run only once on mount


  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null); // Clear previous login errors

    if (!firebaseReady || !auth) {
        setError(configError || "Authentication service is not available.");
        return;
    }

    setLoading(true);
    try {
      // Set session persistence
      await setPersistence(auth, browserSessionPersistence);
      // Sign in
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard'); // Redirect to dashboard on successful login
    } catch (err: any) {
      console.error("Firebase login error:", err);
      let userFriendlyError = 'Failed to log in. Please check your credentials or try again later.';
      switch (err.code) {
          case 'auth/invalid-api-key':
          case 'auth/operation-not-allowed': // Often indicates email/pass or provider not enabled
             userFriendlyError = 'Authentication configuration error. Please contact the administrator.';
             break;
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
             userFriendlyError = 'Invalid email or password. Please try again.';
             break;
          case 'auth/too-many-requests':
             userFriendlyError = 'Too many login attempts. Please try again later.';
             break;
          // Add other specific error codes as needed
      }
      setError(userFriendlyError);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null); // Clear previous login errors

    if (!firebaseReady || !auth) {
      setError(configError || "Authentication service is not available.");
      return;
    }

    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
       // Set session persistence
      await setPersistence(auth, browserSessionPersistence);
       // Sign in with popup
      await signInWithPopup(auth, provider);
      router.push('/dashboard'); // Redirect to dashboard on successful Google sign-in
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      let userFriendlyError = 'Failed to sign in with Google. Please try again.';
       switch (err.code) {
           case 'auth/invalid-api-key':
           case 'auth/operation-not-allowed': // Often indicates Google Sign-In not enabled
               userFriendlyError = 'Google Sign-In configuration error. Please contact the administrator.';
               break;
           case 'auth/popup-closed-by-user':
               userFriendlyError = 'Google Sign-In cancelled.';
               break;
           case 'auth/cancelled-popup-request':
           case 'auth/popup-blocked':
               userFriendlyError = 'Google Sign-In popup was blocked or closed before completion. Please try again.';
               break;
            // Add other specific error codes as needed
       }
      setError(userFriendlyError);
    } finally {
      setGoogleLoading(false);
    }
  };

  const isSubmitDisabled = loading || googleLoading || !firebaseReady;

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">HealthWise Hub</CardTitle>
          <CardDescription>Welcome back! Please log in to your account.</CardDescription>
        </CardHeader>
        <CardContent>
           {configError && (
             <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Configuration Error</AlertTitle>
                <AlertDescription>{configError}</AlertDescription>
              </Alert>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                  aria-label="Email address"
                  disabled={!firebaseReady} // Disable input if Firebase isn't ready
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
               <div className="relative">
                 <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10"
                  aria-label="Password"
                  disabled={!firebaseReady} // Disable input if Firebase isn't ready
                />
              </div>
            </div>
            {error && !configError && ( // Only show login errors if config error isn't present
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Log In
            </Button>
          </form>
           <Separator className="my-6" />
           <Button variant="outline" className="w-full flex items-center justify-center gap-2" onClick={handleGoogleSignIn} disabled={isSubmitDisabled}>
             {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
             Sign in with Google
           </Button>
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground">
           {/* Add link to sign up or forgot password if needed */}
           {/* Example: <p>Don't have an account? <a href="/signup" className="text-primary hover:underline">Sign up</a></p> */}
        </CardFooter>
      </Card>
    </div>
  );
}
