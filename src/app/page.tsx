
import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to the main dashboard since login is removed
  redirect('/dashboard');
}
