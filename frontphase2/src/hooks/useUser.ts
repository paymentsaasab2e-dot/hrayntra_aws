'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGetMe, BackendUser } from '../lib/api';

export function useUser() {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiGetMe();
      if (response.success) {
        setUser(response.data);
        // Sync with localStorage
        const stored = localStorage.getItem('currentUser');
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem('currentUser', JSON.stringify({ ...parsed, ...response.data }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load from localStorage for speed
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      setUser(JSON.parse(stored));
      setLoading(false);
    }
    
    fetchUser();
  }, [fetchUser]);

  return { user, loading, refreshUser: fetchUser };
}
