
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SidebarTrigger } from './ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, UserCircle, Settings } from 'lucide-react';
// Removed direct import of logoutAction, will use API route for logout form submission

interface UserSession {
  userId: string;
  role: 'patient' | 'doctor' | 'admin';
  displayName: string;
  email: string;
}

interface HeaderProps {
  session: UserSession | null;
}

export default function Header({ session }: HeaderProps) {
  const router = useRouter();

  const getInitials = (name: string | undefined): string => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  };

  // Logout will be handled by a form submitting to an API route
  // defined in src/app/api/auth/logout/route.ts

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="md:hidden"/>
          <Link href="/dashboard" className="text-xl font-bold text-primary flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-primary">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634h5.25c.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866s-.059-.605-.189-.866c-.108-.215-.395-.634-.936-.634h-5.25Z" clipRule="evenodd" />
             </svg>
            <span>HealthWise Hub</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                  <Avatar className="h-9 w-9 border-2 border-primary">
                    {/* Add a placeholder image source if available, otherwise initials */}
                    {/* <AvatarImage src={session.photoURL || undefined} alt={session.displayName} /> */}
                    <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                      {getInitials(session.displayName)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{session.displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.email} ({session.role})
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action="/api/auth/logout" method="POST" className="w-full">
                  <button type="submit" className="w-full">
                    <DropdownMenuItem className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" onClick={() => router.push('/login')}>
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
