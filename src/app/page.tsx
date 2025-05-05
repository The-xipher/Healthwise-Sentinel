import Login from '@/components/login';

export default function Home() {
  // Initially show the login page. Authentication state will determine
  // whether to show Login or the appropriate Dashboard.
  // This logic will be handled client-side.
  return <Login />;
}
