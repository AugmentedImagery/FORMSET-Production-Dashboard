import { redirect } from 'next/navigation';

export default function HomePage() {
  // Middleware handles auth-based redirect to /dashboard or /login
  // This is a fallback that should rarely be reached
  redirect('/login');
}
