import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import ErrorBoundary from './components/common/ErrorBoundary';
import { useAppDispatch } from './hooks/useAppDispatch';
import { sessionRestored, sessionCheckFailed } from './store/authSlice';
import * as authApi from './api/authApi';

export default function App() {
  const dispatch = useAppDispatch();

  // Restore session from the httpOnly auth cookie (if any) once, on load -
  // there's no token in localStorage to check synchronously anymore, so
  // ProtectedRoute has to wait for this instead of deciding immediately.
  // Dispatches directly (not via useAuth()) since useAuth() calls
  // useNavigate(), which needs a Router context this component sits above.
  useEffect(() => {
    authApi
      .getCurrentUser()
      .then((user) => dispatch(sessionRestored(user)))
      .catch(() => dispatch(sessionCheckFailed()));
  }, [dispatch]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
