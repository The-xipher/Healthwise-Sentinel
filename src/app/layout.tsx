import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SidebarProvider, Sidebar, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/header';
import Link from 'next/link';
import { Home, User, Stethoscope, ShieldCheck, Database, LogOut } from 'lucide-react'; 
import { getSession } from '@/app/actions/authActions'; 

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
  const session = await getSession(); 

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SidebarProvider>
          <Sidebar variant="inset" collapsible="icon">
             <SidebarMenu className="flex-grow p-2">
                {/* Always show generic dashboard link, it will redirect based on role */}
                <SidebarMenuItem>
                    <Link href="/dashboard">
                        <SidebarMenuButton tooltip="My Dashboard">
                         <Home />
                         <span>My Dashboard</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>

                {session?.role === 'patient' && (
                  <SidebarMenuItem>
                      <Link href="/dashboard/patient">
                          <SidebarMenuButton tooltip="Patient View">
                           <User />
                           <span>Patient View</span>
                          </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
                )}
                {session?.role === 'doctor' && (
                  <SidebarMenuItem>
                      <Link href="/dashboard/doctor">
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
                        <Link href="/dashboard/admin">
                            <SidebarMenuButton tooltip="Admin View">
                             <ShieldCheck />
                             <span>Admin View</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/dashboard/patient">
                            <SidebarMenuButton tooltip="View as Patient (Admin)">
                             <User />
                             <span>Patient View (Admin)</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/dashboard/doctor">
                            <SidebarMenuButton tooltip="View as Doctor (Admin)">
                             <Stethoscope />
                             <span>Doctor View (Admin)</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                  </>
                )}

                <SidebarMenuItem>
                    <Link href="/seed-database">
                        <SidebarMenuButton tooltip="Seed Database">
                         <Database /> 
                         <span>Seed Data</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
             </SidebarMenu>
             {session && (
                <SidebarMenu className="p-2 border-t border-sidebar-border">
                    <form action="/api/auth/logout" method="POST" className="w-full"> 
                         <SidebarMenuItem>
                            <SidebarMenuButton type="submit" tooltip="Logout" className="w-full justify-start">
                                <LogOut />
                                <span>Logout</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </form>
                </SidebarMenu>
             )}
          </Sidebar>
          <SidebarInset>
             <Header session={session} /> 
            {children}
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}