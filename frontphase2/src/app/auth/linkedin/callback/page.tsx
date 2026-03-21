'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

function LinkedInCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code) {
        router.push('/job?linkedin=error&message=Authorization code missing');
        return;
      }

      if (!state) {
        router.push('/job?linkedin=error&message=State parameter missing');
        return;
      }

      try {
        // Forward the callback to backend API
        // The backend will handle OAuth exchange and return a redirect URL
        const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:5000/api/v1';
        const callbackUrl = `${API_BASE}/linkedin/auth/linkedin/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

        // Use window.location to follow the redirect from backend
        // This preserves the redirect flow
        window.location.href = callbackUrl;
      } catch (error: any) {
        console.error('LinkedIn callback error:', error);
        router.push(`/job?linkedin=error&message=${encodeURIComponent(error.message || 'Callback failed')}`);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Connecting your LinkedIn account...</p>
      </div>
    </div>
  );
}

export default function LinkedInCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center text-gray-500">Processing LinkedIn login...</div>}>
      <LinkedInCallbackContent />
    </Suspense>
  );
}
