'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function PasswordResetGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip check for login and reset-password pages
    if (pathname === '/login' || pathname === '/reset-password') {
      return;
    }

    // Check if password reset is required
    if (typeof window !== 'undefined') {
      try {
        const currentUser = localStorage.getItem('currentUser');
        const requirePasswordReset = localStorage.getItem('requirePasswordReset');
        
        if (currentUser) {
          const user = JSON.parse(currentUser);
          
          // Skip password reset requirement for Super Admin
          const isSuperAdmin = user.roleName === 'Super Admin' || user.roleName === 'Superadmin';
          
          if (!isSuperAdmin && (user.requirePasswordReset || requirePasswordReset === 'true')) {
            router.push('/reset-password');
          } else if (isSuperAdmin && requirePasswordReset === 'true') {
            // Clear the flag for Super Admin
            localStorage.removeItem('requirePasswordReset');
            if (user.requirePasswordReset) {
              const updatedUser = { ...user, requirePasswordReset: false };
              localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            }
          }
        }
      } catch (error) {
        console.error('Error checking password reset requirement:', error);
      }
    }
  }, [pathname, router]);

  return <>{children}</>;
}
