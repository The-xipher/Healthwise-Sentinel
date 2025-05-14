
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Bell, LogOut, Settings, UserCircle } from 'lucide-react';
import type { UserSession } from '@/app/actions/authActions';
import type { NotificationItem } from '@/app/actions/userActions';

interface HeaderProps {
  session: UserSession | null;
  unreadMessagesCount: number;
  notificationItems: NotificationItem[];
}

export default function Header({ session, unreadMessagesCount, notificationItems }: HeaderProps) {
  const router = useRouter();

  const getInitials = (name: string | undefined): string => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + (names.length > 1 ? names[names.length - 1][0] : '')).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Link href={session ? "/dashboard" : "/"} className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 200 200" className="h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" data-ai-hint="logo health">
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor: 'hsl(var(--primary))', stopOpacity:1}} />
                <stop offset="100%" style={{stopColor: 'hsl(var(--accent))', stopOpacity:1}} />
                </linearGradient>
            </defs>
            <path fill="url(#grad1)" d="M100,10 C149.7056,10 190,50.2944 190,100 C190,149.7056 149.7056,190 100,190 C50.2944,190 10,149.7056 10,100 C10,50.2944 50.2944,10 100,10 Z M100,30 C61.3401,30 30,61.3401 30,100 C30,138.6599 61.3401,170 100,170 C138.6599,170 170,138.6599 170,100 C170,61.3401 138.6599,30 100,30 Z" />
            <path fill="hsl(var(--primary-foreground))" d="M100,70 L130,100 L100,130 L70,100 Z" />
            <circle fill="hsl(var(--primary))" cx="100" cy="100" r="20" />
          </svg>
          <span className="text-xl font-semibold text-foreground hidden md:block">HealthWise Hub</span>
        </Link>
      </div>
      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4 justify-end">
        {/* Search bar (optional) - can be added here */}
        <div className="ml-auto flex items-center gap-3">
          {session ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative rounded-full">
                    <Bell className="h-5 w-5" />
                    {unreadMessagesCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 min-w-[1.25rem] p-0 flex items-center justify-center text-xs rounded-full"
                      >
                        {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                      </Badge>
                    )}
                    <span className="sr-only">Notifications</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-w-md">
                  <DropdownMenuLabel className="px-3 py-2 text-base">Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notificationItems.length > 0 ? (
                    <>
                    <ScrollArea className="h-[300px]">
                      {notificationItems.map((item) => (
                        <DropdownMenuItem asChild key={item.id}>
                          <Link href={item.href} className="flex flex-col items-start p-2 hover:bg-accent rounded-md w-full cursor-pointer">
                            <div className="flex justify-between w-full items-center">
                                <span className="font-semibold text-sm">{item.title}</span>
                                <span className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate w-full">{item.description}</p>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </ScrollArea>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="w-full text-center text-sm text-primary py-1 cursor-pointer">View All Notifications</Link>
                     </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem disabled className="text-center text-sm text-muted-foreground p-4">No new notifications</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                    <Avatar className="h-9 w-9 border-2 border-primary">
                      <AvatarImage src={(session as any).photoURL || undefined} alt={session.displayName} data-ai-hint="profile avatar"/>
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
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/profile" className="flex items-center w-full cursor-pointer">
                      <UserCircle className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
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
            </>
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
