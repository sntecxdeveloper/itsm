import React from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';

interface RoleGuardProps {
  /** Required role(s) — user must have at least one of these */
  roles: string[];
  /** Content to render if authorized */
  children: React.ReactNode;
  /** Content to render if NOT authorized (optional) */
  fallback?: React.ReactNode;
}

/**
 * Renders children only if the current user has one of the required roles.
 * Usage:
 *   <RoleGuard roles={['ROLE_ADMIN', 'ROLE_OPERATOR']}>
 *     <DeleteButton />
 *   </RoleGuard>
 */
export function RoleGuard({ roles, children, fallback }: RoleGuardProps) {
  const { user } = useAppSelector((state) => state.auth);

  if (!user || !roles.includes(user.role)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

/**
 * Hook to check if current user has a specific role.
 */
export function useHasRole(role: string): boolean {
  const { user } = useAppSelector((state) => state.auth);
  return user?.role === role;
}

/**
 * Hook to check if current user can write (admin or operator).
 */
export function useCanWrite(): boolean {
  const { user } = useAppSelector((state) => state.auth);
  return user?.role === 'ROLE_ADMIN' || user?.role === 'ROLE_OPERATOR';
}

/**
 * Hook to check if current user is admin.
 */
export function useIsAdmin(): boolean {
  return useHasRole('ROLE_ADMIN');
}

export default RoleGuard;
