'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hosts Phase 2 CRM pages inside HQ without editing those page files.
 * Fixes viewport height (Phase 2 assumes a 3.5rem top bar) and clipping.
 * Rewrites Phase 2 CRM links so navigation stays under /hq/*.
 */
function rewriteHqCrmHref(href: string): string | null {
  if (!href || href.startsWith('http') || href.startsWith('#')) return null;
  if (href === '/leads' || href.startsWith('/leads?') || href.startsWith('/leads/')) {
    return href.replace(/^\/leads/, '/hq/leads');
  }
  if (href === '/client' || href.startsWith('/client?') || href.startsWith('/client/')) {
    return href.replace(/^\/client/, '/hq/clients');
  }
  if (href === '/dashboard' || href.startsWith('/dashboard?') || href.startsWith('/dashboard#')) {
    return href.replace(/^\/dashboard/, '/hq/crm-dashboard');
  }
  if (href === '/team' || href.startsWith('/team?') || href.startsWith('/team/')) {
    return href.replace(/^\/team/, '/hq/team');
  }
  if (href === '/reports' || href.startsWith('/reports?') || href.startsWith('/reports/')) {
    return href.replace(/^\/reports/, '/hq/reports');
  }
  return null;
}

export function HqCrmEmbed({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const raw = anchor.getAttribute('href') || '';
      const next = rewriteHqCrmHref(raw);
      if (!next) return;
      event.preventDefault();
      router.push(next);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  return (
    <div className="hq-crm-embed relative h-[100dvh] min-h-0 w-full overflow-hidden bg-[#F8FAFC]">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .hq-crm-embed .ph2-page-shell {
              height: 100dvh !important;
              max-height: 100dvh !important;
            }
            .hq-crm-embed .ph2-main-surface {
              margin-left: 0 !important;
              padding-top: 0 !important;
            }
          `,
        }}
      />
      {children}
    </div>
  );
}
