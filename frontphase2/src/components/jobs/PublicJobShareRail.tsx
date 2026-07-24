'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Check, Copy, Mail } from 'lucide-react';
import { toast } from 'sonner';

type SharePlatform = {
  id: string;
  label: string;
  bg: string;
  href?: string;
  /** When true, copies the link (WeChat has no reliable web share URL). */
  copyLink?: boolean;
  icon: React.ReactNode;
};

type Props = {
  /** Full public apply URL to share (includes tenant query when present). */
  shareUrl: string;
  jobTitle?: string | null;
};

function openShareWindow(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer,width=640,height=640');
}

export function PublicJobShareRail({ shareUrl, jobTitle }: Props) {
  const [copied, setCopied] = useState(false);

  const shareText = useMemo(() => {
    const title = String(jobTitle || 'this role').trim();
    return `Check out this job opportunity: ${title}`;
  }, [jobTitle]);

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);
  const encodedSubject = encodeURIComponent(jobTitle ? `Job: ${jobTitle}` : 'Job opportunity');
  const encodedBody = encodeURIComponent(`${shareText}\n\n${shareUrl}`);

  const copyShareLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied — paste it in WeChat or anywhere else');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  }, [shareUrl]);

  const platforms: SharePlatform[] = useMemo(
    () => [
      {
        id: 'facebook',
        label: 'Share on Facebook',
        bg: 'bg-[#1877F2] hover:bg-[#166FE5]',
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        icon: (
          <span className="text-[15px] font-bold leading-none" aria-hidden>
            f
          </span>
        ),
      },
      {
        id: 'x',
        label: 'Share on X',
        bg: 'bg-black hover:bg-neutral-800',
        href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
        icon: (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.833L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
          </svg>
        ),
      },
      {
        id: 'email',
        label: 'Share via Email',
        bg: 'bg-slate-600 hover:bg-slate-700',
        href: `mailto:?subject=${encodedSubject}&body=${encodedBody}`,
        icon: <Mail className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />,
      },
      {
        id: 'linkedin',
        label: 'Share on LinkedIn',
        bg: 'bg-[#0A66C2] hover:bg-[#0959aa]',
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        icon: (
          <span className="text-[11px] font-bold leading-none tracking-tight" aria-hidden>
            in
          </span>
        ),
      },
      {
        id: 'whatsapp',
        label: 'Share on WhatsApp',
        bg: 'bg-[#25D366] hover:bg-[#1ebe57]',
        href: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
        icon: (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        ),
      },
      {
        id: 'gmail',
        label: 'Share via Gmail',
        bg: 'bg-[#EA4335] hover:bg-[#d33426]',
        href: `https://mail.google.com/mail/?view=cm&fs=1&su=${encodedSubject}&body=${encodedBody}`,
        icon: <Mail className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />,
      },
      {
        id: 'telegram',
        label: 'Share on Telegram',
        bg: 'bg-[#229ED9] hover:bg-[#1b8ec4]',
        href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
        icon: (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.788.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
        ),
      },
      {
        id: 'wechat',
        label: 'Copy link for WeChat',
        bg: 'bg-[#07C160] hover:bg-[#06ad56]',
        copyLink: true,
        icon: (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.999.999 0 0 1 .366.783c0 .185-.048.364-.133.523-.266.505-.567 1.039-.567 1.039s-.218.252-.046.494c.134.186.36.244.36.244s1.42.076 2.606-.513a1.64 1.64 0 0 1 .982-.186c.78.2 1.607.308 2.461.308 4.8 0 8.691-3.288 8.691-7.342 0-4.054-3.891-7.342-8.691-7.342zm-2.32 4.91a.98.98 0 1 1 0 1.96.98.98 0 0 1 0-1.96zm4.64 0a.98.98 0 1 1 0 1.96.98.98 0 0 1 0-1.96zm7.95 3.403c-3.547 0-6.42 2.467-6.42 5.508 0 1.66.877 3.153 2.251 4.163a.75.75 0 0 1 .274.587c0 .139-.036.273-.1.392-.2.379-.425.779-.425.779s-.164.189-.035.37c.1.14.27.183.27.183s1.065.057 1.955-.385a1.23 1.23 0 0 1 .736-.14c.585.15 1.205.231 1.845.231 3.547 0 6.42-2.467 6.42-5.508 0-3.041-2.873-5.508-6.42-5.508zm-2.58 3.682a.735.735 0 1 1 0 1.47.735.735 0 0 1 0-1.47zm3.48 0a.735.735 0 1 1 0 1.47.735.735 0 0 1 0-1.47z" />
          </svg>
        ),
      },
    ],
    [encodedBody, encodedSubject, encodedText, encodedUrl, shareText, shareUrl],
  );

  if (!shareUrl) return null;

  return (
    <aside
      className="pointer-events-none fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 sm:block"
      aria-label="Share this job"
    >
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-l-xl border border-r-0 border-slate-200 bg-white shadow-lg shadow-slate-900/10">
        <div className="border-b border-slate-100 bg-slate-50 px-2 py-1.5 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Share</p>
        </div>
        {platforms.map((platform) => {
          const className = `flex h-10 w-10 items-center justify-center text-white transition-colors ${platform.bg}`;
          if (platform.copyLink) {
            return (
              <button
                key={platform.id}
                type="button"
                title={platform.label}
                aria-label={platform.label}
                onClick={() => void copyShareLink()}
                className={className}
              >
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : platform.icon}
              </button>
            );
          }
          return (
            <a
              key={platform.id}
              href={platform.href}
              title={platform.label}
              aria-label={platform.label}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
              onClick={(event) => {
                if (!platform.href || platform.href.startsWith('mailto:')) return;
                event.preventDefault();
                openShareWindow(platform.href);
              }}
            >
              {platform.icon}
            </a>
          );
        })}
        <button
          type="button"
          title="Copy apply link"
          aria-label="Copy apply link"
          onClick={() => void copyShareLink()}
          className="flex h-10 w-10 items-center justify-center border-t border-slate-100 bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        </button>
      </div>
    </aside>
  );
}
