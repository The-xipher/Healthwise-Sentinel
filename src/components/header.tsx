'use client';

import * as React from 'react';
import Link from 'next/link';
import { SidebarTrigger } from './ui/sidebar';

// Simplified Header without user authentication elements
export default function Header() {

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="md:hidden"/>
          <Link href="/dashboard" className="text-xl font-bold text-primary flex items-center gap-2">
             {/* Optional: Add an icon/logo here */}
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-primary">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634h5.25c.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866s-.059-.605-.189-.866c-.108-.215-.395-.634-.936-.634h-5.25Z" clipRule="evenodd" />
             </svg>
            <span>HealthWise Hub</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {/* Placeholder for potential future actions or static links */}
          {/* <Button variant="outline">Help</Button> */}
        </div>
      </div>
    </header>
  );
}
