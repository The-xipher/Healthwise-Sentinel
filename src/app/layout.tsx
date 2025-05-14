import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SidebarProvider, Sidebar, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/header';
import Link from 'next/link';
import { Home, User, Stethoscope, ShieldCheck, Database, LogOut, Bell } from 'lucide-react'; 
import { getSession, type UserSession } from '@/app/actions/authActions'; 
import { fetchNotificationItemsAction, type NotificationItem } from '@/app/actions/userActions';

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
  let notificationItems: NotificationItem[] = [];
  let unreadMessagesCount = 0;

  if (session) {
    const notificationResult = await fetchNotificationItemsAction(session.userId, session.role);
    if (notificationResult.items) {
      notificationItems = notificationResult.items;
      unreadMessagesCount = notificationResult.unreadCount;
    } else if (notificationResult.error) {
      console.warn("Could not fetch notification items for layout:", notificationResult.error);
    }
  }

  let myDashboardPath = "/dashboard"; // Default path
  if (session) {
    switch (session.role) {
      case 'patient':
        myDashboardPath = "/dashboard/patient";
        break;
      case 'doctor':
        myDashboardPath = "/dashboard/doctor";
        break;
      case 'admin':
        myDashboardPath = "/dashboard/admin";
        break;
      default:
        myDashboardPath = "/dashboard"; 
    }
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SidebarProvider>
          <Sidebar variant="inset" collapsible="icon">
             <SidebarMenu className="flex-grow p-2">
                <SidebarMenuItem>
                    <Link href={myDashboardPath} passHref legacyBehavior>
                        <SidebarMenuButton tooltip="My Dashboard">
                         <Home />
                         <span>My Dashboard</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>

                {/* 
                  Specific role view links are now conditional.
                  They are only shown if they offer a different perspective than "My Dashboard".
                  For example, an admin might want to view the patient dashboard structure.
                */}

                {/* Admin can view other dashboards */}
                 {session?.role === 'admin' && (
                  <>
                    {/* "Admin View" is covered by "My Dashboard" for admin, so it's removed here */}
                    <SidebarMenuItem>
                        <Link href="/dashboard/patient" passHref legacyBehavior>
                            <SidebarMenuButton tooltip="View as Patient (Admin)">
                             <User />
                             <span>Patient View (Admin)</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/dashboard/doctor" passHref legacyBehavior>
                            <SidebarMenuButton tooltip="View as Doctor (Admin)">
                             <Stethoscope />
                             <span>Doctor View (Admin)</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                  </>
                )}

                {/* 
                  For non-admin users, if "My Dashboard" already points to their role-specific dashboard,
                  the extra "Patient View" or "Doctor View" link is redundant and thus removed.
                */}
                
                {/* Example: If a future role might need an explicit link different from their "My Dashboard"
                {session?.role === 'some_other_role_that_is_not_patient_or_doctor_or_admin' && (
                  <SidebarMenuItem>
                      <Link href="/dashboard/some_other_role" passHref legacyBehavior>
                          <SidebarMenuButton tooltip="Some Other View">
                           <User /> 
                           <span>Some Other View</span>
                          </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
                )}
                */}

                <SidebarMenuItem>
                    <Link href="/seed-database" passHref legacyBehavior>
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
             <Header session={session} unreadMessagesCount={unreadMessagesCount} notificationItems={notificationItems} /> 
            {children}
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
