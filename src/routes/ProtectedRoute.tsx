import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, sessionChecked } = useAppSelector((state) => state.auth);

  // The one-time /auth/me check (App.tsx) hasn't resolved yet - there's no
  // synchronous way to know if the httpOnly cookie is valid, so wait rather
  // than redirecting a genuinely logged-in user to /login on every refresh.
  if (!sessionChecked) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
