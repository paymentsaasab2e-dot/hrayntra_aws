'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGetMe, apiRefreshToken, BackendUser, getAccessToken } from '../lib/api';

function isAuthRequiredError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Authentication required|Please log in|No refresh token/i.test(message);
}

export function useUser() {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);

      let token = getAccessToken();
      const refreshToken =
        typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

      // Global hosts (intelligence, sidenav) mount on login/public pages too —
      // never hit /users/me without credentials (avoids console auth errors).
      if (!token && refreshToken) {
        try {
          await apiRefreshToken();
          token = getAccessToken();
        } catch {
          token = null;
        }
      }

      if (!token) {
        setUser(null);
        return;
      }

      const response = await apiGetMe();
      if (response.success) {
        setUser(response.data);
        const stored = localStorage.getItem('currentUser');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            localStorage.setItem('currentUser', JSON.stringify({ ...parsed, ...response.data }));
          } catch {
            localStorage.setItem('currentUser', JSON.stringify(response.data));
          }
        } else {
          localStorage.setItem('currentUser', JSON.stringify(response.data));
        }
      }
    } catch (error) {
      if (!isAuthRequiredError(error)) {
        console.error('Failed to fetch user:', error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    const stored = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;

    // Hydrate from cache only when a session token still exists.
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
        setLoading(false);
      } catch {
        /* ignore corrupt cache */
      }
    } else if (!token) {
      setUser(null);
      setLoading(false);
    }

    void fetchUser();
  }, [fetchUser]);

  return { user, loading, refreshUser: fetchUser };
}
