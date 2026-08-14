import { useState, useEffect, useCallback } from 'react';
import {
  apiGetLinkedInStatus,
  apiInitiateLinkedInAuth,
  apiPostJobToLinkedIn,
  apiDisconnectLinkedIn,
  apiDisconnectLinkedInAccount,
  type LinkedInPostJobData,
  type SocialPublishingAccount,
} from '../lib/api';

export interface LinkedInUser {
  name: string;
  picture?: string;
}

export type LinkedInConnectOptions = {
  /** When true (default), Create Job drawer reopens after OAuth. */
  reopenCreateJobDrawer?: boolean;
};

export function useLinkedIn() {
  const [isConnected, setIsConnected] = useState(false);
  const [linkedinUser, setLinkedinUser] = useState<LinkedInUser | null>(null);
  const [accounts, setAccounts] = useState<SocialPublishingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiGetLinkedInStatus();
      const status = response.data;

      const loadedAccounts = status.accounts || [];
      setAccounts(loadedAccounts);
      setIsConnected(status.connected && !status.expired);
      if (status.connected && status.name) {
        setLinkedinUser({
          name: status.name,
          picture: status.picture || undefined,
        });
      } else {
        setLinkedinUser(null);
      }

      if (status.expired) {
        setError('Your LinkedIn connection expired. Please reconnect.');
      }
    } catch (err: any) {
      console.error('Failed to check LinkedIn status:', err);
      setIsConnected(false);
      setLinkedinUser(null);
      setAccounts([]);
      setError(err.message || 'Failed to check LinkedIn connection');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connect = useCallback(async (options?: LinkedInConnectOptions) => {
    try {
      setError(null);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('oauth_navigation', '1');
        sessionStorage.setItem('oauth_provider', 'linkedin');
        if (options?.reopenCreateJobDrawer !== false) {
          sessionStorage.setItem('reopen_create_job_drawer', '1');
        } else {
          sessionStorage.removeItem('reopen_create_job_drawer');
        }
      }
      const response = await apiInitiateLinkedInAuth();
      const { authUrl, state } = response.data || {};

      if (!authUrl || typeof authUrl !== 'string') {
        throw new Error(response.message || 'LinkedIn login URL was not returned. Check LinkedIn app credentials.');
      }

      // Store state in localStorage for CSRF protection
      localStorage.setItem('linkedin_oauth_state', state || '');

      // Redirect to LinkedIn OAuth
      window.location.assign(authUrl);
    } catch (err: any) {
      console.error('Failed to initiate LinkedIn auth:', err);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('oauth_navigation');
        sessionStorage.removeItem('oauth_provider');
        if (options?.reopenCreateJobDrawer === false) {
          sessionStorage.removeItem('reopen_create_job_drawer');
        }
      }
      setError(err.message || 'Failed to connect to LinkedIn');
      throw err;
    }
  }, []);

  const disconnect = useCallback(async (accountId?: string) => {
    try {
      setError(null);
      if (accountId) {
        await apiDisconnectLinkedInAccount(accountId);
      } else {
        await apiDisconnectLinkedIn();
      }
      await checkStatus();
      localStorage.removeItem('linkedin_oauth_state');
    } catch (err: any) {
      console.error('Failed to disconnect LinkedIn:', err);
      setError(err.message || 'Failed to disconnect LinkedIn');
      throw err;
    }
  }, [checkStatus]);

  const postJob = useCallback(async (jobData: LinkedInPostJobData) => {
    try {
      setError(null);
      const response = await apiPostJobToLinkedIn(jobData);
      return response.data;
    } catch (err: any) {
      console.error('Failed to post job to LinkedIn:', err);
      
      if (err.message?.includes('expired') || err.message?.includes('reconnect')) {
        setIsConnected(false);
        setLinkedinUser(null);
        setError('LinkedIn connection expired. Please reconnect.');
      } else if (err.message?.includes('rate limit')) {
        setError('LinkedIn rate limit reached. Try again in 15 minutes.');
      } else {
        setError(err.message || 'Failed to post to LinkedIn');
      }
      
      throw err;
    }
  }, []);

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Handle OAuth callback from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedinParam = params.get('linkedin');
    
    if (linkedinParam === 'connected') {
      // Refresh status after successful connection
      checkStatus();
      // Clean up URL (remove query params)
      const url = new URL(window.location.href);
      url.searchParams.delete('linkedin');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
    } else if (linkedinParam === 'error') {
      const message = params.get('message') || 'LinkedIn connection failed';
      setError(decodeURIComponent(message));
      // Clean up URL (remove query params)
      const url = new URL(window.location.href);
      url.searchParams.delete('linkedin');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
    }
  }, [checkStatus]);

  return {
    isConnected,
    linkedinUser,
    accounts,
    isLoading,
    error,
    connect,
    disconnect,
    postJob,
    refreshStatus: checkStatus,
  };
}
