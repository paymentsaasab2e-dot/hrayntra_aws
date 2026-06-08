import React from 'react';

const URL_RE = /https?:\/\/[^\s]+/g;

/** Render plain social post text with clickable external links (new tab). */
export function linkifyPostText(text: string): React.ReactNode[] {
  const source = String(text || '');
  if (!source) return [];

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(URL_RE)) {
    const url = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      nodes.push(source.slice(lastIndex, start));
    }
    nodes.push(
      url.includes('[link-on-save]') ? (
        <span key={`url-${start}`} className="text-slate-500 break-all">
          {url}
        </span>
      ) : (
        <a
          key={`url-${start}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0a66c2] hover:underline break-all"
        >
          {url}
        </a>
      ),
    );
    lastIndex = start + url.length;
  }

  if (lastIndex < source.length) {
    nodes.push(source.slice(lastIndex));
  }

  return nodes.length ? nodes : [source];
}
