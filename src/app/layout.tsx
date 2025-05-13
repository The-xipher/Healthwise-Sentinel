
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SidebarProvider, Sidebar, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/header';
import Link from 'next/link';
import { Home, User, Stethoscope, ShieldCheck, Database, LogOut, Users } from 'lucide-react'; // Changed DatabaseCog to Database
import { getSession } from '@/app/actions/authActions'; // Import getSession

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'HealthWise Hub',
  description: 'Post-discharge patient care management using AI-driven insights.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession(); // Fetch session data on the server

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SidebarProvider defaultOpen={true}>
          <Sidebar variant="inset" collapsible="icon">
             <SidebarMenu className="flex-grow p-2">
                {/* Always show generic dashboard link, it will redirect based on role */}
                <SidebarMenuItem>
                    <Link href="/dashboard" legacyBehavior passHref>
                        <SidebarMenuButton tooltip="My Dashboard">
                         <Home />
                         <span>My Dashboard</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>

                {session?.role === 'patient' && (
                  <SidebarMenuItem>
                      <Link href="/dashboard/patient" legacyBehavior passHref>
                          <SidebarMenuButton tooltip="Patient View">
                           <User />
                           <span>Patient View</span>
                          </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
                )}
                {session?.role === 'doctor' && (
                  <SidebarMenuItem>
                      <Link href="/dashboard/doctor" legacyBehavior passHref>
                          <SidebarMenuButton tooltip="Doctor View">
                           <Stethoscope />
                           <span>Doctor View</span>
                          </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
                )}
                 {session?.role === 'admin' && (
                  <>
                    <SidebarMenuItem>
                        <Link href="/dashboard/admin" legacyBehavior passHref>
                            <SidebarMenuButton tooltip="Admin View">
                             <ShieldCheck />
                             <span>Admin View</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/dashboard/patient" legacyBehavior passHref>
                            <SidebarMenuButton tooltip="View as Patient (Admin)">
                             <User />
                             <span>Patient View (Admin)</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/dashboard/doctor" legacyBehavior passHref>
                            <SidebarMenuButton tooltip="View as Doctor (Admin)">
                             <Stethoscope />
                             <span>Doctor View (Admin)</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                  </>
                )}

                <SidebarMenuItem>
                    <Link href="/seed-database" legacyBehavior passHref>
                        <SidebarMenuButton tooltip="Seed Database">
                         <Database /> {/* Changed DatabaseCog to Database */}
                         <span>Seed Data</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
             </SidebarMenu>
             {session && (
                <SidebarMenu className="p-2 border-t border-sidebar-border">
                    <form action="/api/auth/logout" method="POST"> {/* Use API route for logout */}
                         <SidebarMenuItem>
                            <button type="submit" className="w-full">
                                <SidebarMenuButton tooltip="Logout">
                                    <LogOut />
                                    <span>Logout</span>
                                </SidebarMenuButton>
                            </button>
                        </SidebarMenuItem>
                    </form>
                </SidebarMenu>
             )}
          </Sidebar>
          <SidebarInset>
             <Header session={session} /> {/* Pass session to Header */}
            {children}
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
