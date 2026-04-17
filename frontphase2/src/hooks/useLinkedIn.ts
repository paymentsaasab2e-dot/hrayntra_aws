import { useState, useEffect, useCallback } from 'react';
import { apiGetLinkedInStatus, apiInitiateLinkedInAuth, apiPostJobToLinkedIn, apiDisconnectLinkedIn, type LinkedInStatus, type LinkedInPostJobData } from '../lib/api';

export interface LinkedInUser {
  name: string;
  picture?: string;
}

export function useLinkedIn() {
  const [isConnected, setIsConnected] = useState(false);
  const [linkedinUser, setLinkedinUser] = useState<LinkedInUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiGetLinkedInStatus();
      const status = response.data;

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
      setError(err.message || 'Failed to check LinkedIn connection');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      const response = await apiInitiateLinkedInAuth();
      const { authUrl, state } = response.data;

      // Store state in localStorage for CSRF protection
      localStorage.setItem('linkedin_oauth_state', state);

      // Redirect to LinkedIn OAuth
      window.location.href = authUrl;
    } catch (err: any) {
      console.error('Failed to initiate LinkedIn auth:', err);
      setError(err.message || 'Failed to connect to LinkedIn');
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      setError(null);
      await apiDisconnectLinkedIn();
      setIsConnected(false);
      setLinkedinUser(null);
      localStorage.removeItem('linkedin_oauth_state');
    } catch (err: any) {
      console.error('Failed to disconnect LinkedIn:', err);
      setError(err.message || 'Failed to disconnect LinkedIn');
      throw err;
    }
  }, []);

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
    isLoading,
    error,
    connect,
    disconnect,
    postJob,
    refreshStatus: checkStatus,
  };
}
