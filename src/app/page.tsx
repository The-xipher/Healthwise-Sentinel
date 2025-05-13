// src/app/page.tsx
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BarChart, Users, ShieldCheck, Activity } from 'lucide-react';
import { getSession } from '@/app/actions/authActions';

export default async function LandingPage() {
  const session = await getSession();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 text-foreground p-4 overflow-hidden">
      <div className="text-center space-y-8 max-w-3xl">
        <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Welcome to <span className="text-primary">HealthWise Hub</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground">
            Your partner in intelligent post-discharge patient care. Empowering health professionals with AI-driven insights for better patient outcomes.
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-300">
          <Link href={session ? "/dashboard" : "/login"}>
            <Button size="lg" className="text-lg py-7 px-10 shadow-lg hover:shadow-primary/30 transition-shadow duration-300">
              Access Your Dashboard
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-12">
          {[
            { icon: <BarChart className="h-8 w-8 text-primary" />, title: "AI Insights", description: "Leverage AI for risk prediction and personalized care plans." , delay: 500},
            { icon: <Users className="h-8 w-8 text-primary" />, title: "Patient Management", description: "Streamlined dashboards for patient monitoring and engagement." , delay: 700},
            { icon: <Activity className="h-8 w-8 text-primary" />, title: "Real-time Data", description: "Simulated real-time health data tracking and alerts." , delay: 900},
            { icon: <ShieldCheck className="h-8 w-8 text-primary" />, title: "Secure & Compliant", description: "Built with security and privacy in mind (simulated)." , delay: 1100},
          ].map((feature, index) => (
            <div 
              key={index} 
              className="p-6 bg-card rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 animate-in fade-in zoom-in-90 duration-700"
              style={{animationDelay: `${feature.delay}ms`}}
              data-ai-hint="feature card"
            >
              <div className="flex justify-center mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2 text-card-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
      <footer className="absolute bottom-6 text-center text-sm text-muted-foreground animate-in fade-in duration-1000 delay-[1500ms]">
        © {new Date().getFullYear()} HealthWise Hub. All rights reserved. (Demo Application)
      </footer>
    </main>
  );
}
