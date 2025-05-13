
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SidebarProvider, Sidebar, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/header'; // Import the simplified header
import Link from 'next/link'; // Import Link
import { Home, Database, Stethoscope, ShieldCheck } from 'lucide-react'; // Import icons

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SidebarProvider defaultOpen={true} > {/* Keep sidebar open by default */}
          <Sidebar variant="inset" collapsible="icon">
             <SidebarMenu className="flex-grow p-2">
                <SidebarMenuItem>
                    <Link href="/dashboard" legacyBehavior passHref>
                        <SidebarMenuButton tooltip="Patient Dashboard">
                         <Home />
                         <span>Patient View</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <Link href="/dashboard/doctor" legacyBehavior passHref>
                        <SidebarMenuButton tooltip="Doctor Dashboard">
                         <Stethoscope />
                         <span>Doctor View</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <Link href="/dashboard/admin" legacyBehavior passHref>
                        <SidebarMenuButton tooltip="Admin Dashboard">
                         <ShieldCheck />
                         <span>Admin View</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <Link href="/seed-database" legacyBehavior passHref>
                        <SidebarMenuButton tooltip="Seed Database">
                         <Database />
                         <span>Seed Data</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
             </SidebarMenu>
          </Sidebar>
          <SidebarInset>
             <Header /> 
            {children}
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
