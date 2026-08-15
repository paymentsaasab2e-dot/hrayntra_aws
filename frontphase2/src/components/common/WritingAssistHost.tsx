'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isEmployerPublicAuthPath } from '@/lib/sessionAuth';
import {
  applyWritingSpan,
  getCaretViewportRect,
  getWritingSpanSuggestions,
  pickSpanNearCaret,
  type WritingSpanSuggestion,
} from '@/lib/writing-assist';

type FieldEl = HTMLInputElement | HTMLTextAreaElement;
type AssistEl = FieldEl | HTMLElement;

function isFieldEl(el: Element): el is FieldEl {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

function skipByName(el: HTMLElement) {
  const blob = `${el.getAttribute('name') || ''} ${el.id || ''} ${el.getAttribute('autocomplete') || ''} ${
    el.getAttribute('inputmode') || ''
  }`.toLowerCase();
  return /password|otp|one-time|verification.?code|cc-number|cc-csc|card.?number|pin\b|username|user.?id|email|identifier|login/.test(
    blob,
  );
}

function isAssistableInput(el: Element): el is FieldEl {
  if (!isFieldEl(el)) return false;
  if (el.disabled || el.readOnly) return false;
  if (el.dataset.writingAssist === 'off') return false;
  if (skipByName(el)) return false;

  const ac = String(el.getAttribute('autocomplete') || '').toLowerCase();
  if (
    [
      'password',
      'current-password',
      'new-password',
      'one-time-code',
      'cc-number',
      'cc-csc',
      'email',
      'username',
    ].includes(ac)
  ) {
    return false;
  }

  const im = String(el.getAttribute('inputmode') || '').toLowerCase();
  if (['numeric', 'decimal', 'tel', 'email'].includes(im)) return false;

  if (el instanceof HTMLTextAreaElement) return true;

  const type = String(el.type || 'text').toLowerCase();
  return type === 'text' || type === 'search' || type === 'url' || type === '';
}

function closestAssistable(target: EventTarget | null): AssistEl | null {
  if (!(target instanceof Element)) return null;
  if (target.closest('[data-writing-assist="off"]')) return null;
  if (target.closest('.monaco-editor, .cm-editor, [data-slate-editor="true"]')) return null;

  if (isAssistableInput(target)) return target;

  const ce = target.closest('[contenteditable="true"], [contenteditable=""]') as HTMLElement | null;
  if (ce && ce.isContentEditable && ce.dataset.writingAssist !== 'off' && !skipByName(ce)) {
    return ce;
  }
  return null;
}

function getTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

function plainOffsetToDom(root: HTMLElement, offset: number): { node: Text; offset: number } | null {
  const nodes = getTextNodes(root);
  let remaining = Math.max(0, offset);
  for (const node of nodes) {
    const len = node.data.length;
    if (remaining <= len) return { node, offset: remaining };
    remaining -= len;
  }
  const last = nodes[nodes.length - 1];
  return last ? { node: last, offset: last.data.length } : null;
}

function contentEditableCaret(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.focusNode)) {
    return (el.textContent || '').length;
  }
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(sel.focusNode as Node, sel.focusOffset);
  return pre.toString().length;
}

function contentEditableCaretRect(el: HTMLElement, position: number): { top: number; left: number; height: number } {
  const loc = plainOffsetToDom(el, position);
  if (!loc) {
    const fallback = el.getBoundingClientRect();
    return { top: fallback.top, left: fallback.left, height: 18 };
  }
  const range = document.createRange();
  range.setStart(loc.node, loc.offset);
  range.collapse(true);
  const rect = range.getBoundingClientRect();
  if (!rect.height && !rect.width) {
    const fallback = el.getBoundingClientRect();
    return { top: fallback.top + 8, left: fallback.left + 8, height: 18 };
  }
  return { top: rect.top, left: rect.left, height: rect.height || 18 };
}

function readAssistValue(el: AssistEl): { text: string; caret: number } {
  if (isFieldEl(el)) {
    const text = el.value || '';
    return { text, caret: el.selectionStart ?? text.length };
  }
  const text = el.textContent || '';
  return { text, caret: contentEditableCaret(el) };
}

function setNativeFieldValue(el: FieldEl, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function applyContentEditableSpan(el: HTMLElement, span: WritingSpanSuggestion) {
  const start = plainOffsetToDom(el, span.start);
  const end = plainOffsetToDom(el, span.end);
  if (!start || !end) return;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  range.deleteContents();
  const node = document.createTextNode(span.suggestion);
  range.insertNode(node);
  const after = document.createRange();
  after.setStart(node, node.data.length);
  after.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(after);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Global Grammarly-style writing assist for every text / textarea / contenteditable field in Phase 2.
 */
export function WritingAssistHost() {
  const pathname = usePathname();
  const [target, setTarget] = useState<AssistEl | null>(null);
  const [active, setActive] = useState<WritingSpanSuggestion | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<AssistEl | null>(null);

  const refresh = useCallback((el: AssistEl | null) => {
    if (isEmployerPublicAuthPath(pathname)) {
      setTarget(null);
      setActive(null);
      setPos(null);
      targetRef.current = null;
      return;
    }
    if (!el || document.activeElement === tooltipRef.current) return;

    const focused =
      !!el &&
      (document.activeElement === el || (document.activeElement instanceof Node && el.contains(document.activeElement)));

    if (!el || !focused) {
      setTarget(null);
      setActive(null);
      setPos(null);
      targetRef.current = null;
      return;
    }

    const { text, caret } = readAssistValue(el);
    const spans = getWritingSpanSuggestions(text, { max: 14 });
    const span = pickSpanNearCaret(spans, caret);

    targetRef.current = el;
    setTarget(el);
    setActive(span);

    if (!span) {
      setPos(null);
      return;
    }

    const anchor = Math.min(Math.max(span.end, 0), text.length);
    const rect = isFieldEl(el) ? getCaretViewportRect(el, anchor) : contentEditableCaretRect(el, anchor);
    const tooltipW = 220;
    setPos({
      left: Math.min(Math.max(8, rect.left), window.innerWidth - tooltipW - 8),
      top: Math.min(rect.top + rect.height + 6, window.innerHeight - 56),
    });
  }, [pathname]);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = closestAssistable(e.target);
      if (el) refresh(el);
    };

    const onFocusOut = () => {
      window.setTimeout(() => {
        const next = document.activeElement;
        if (tooltipRef.current?.contains(next)) return;
        const el = closestAssistable(next);
        if (el) {
          refresh(el);
          return;
        }
        refresh(null);
      }, 140);
    };

    const onMaybeRefresh = (e: Event) => {
      const el = closestAssistable(e.target);
      if (el) refresh(el);
    };

    const onViewport = () => refresh(targetRef.current);

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('input', onMaybeRefresh, true);
    document.addEventListener('keyup', onMaybeRefresh, true);
    document.addEventListener('click', onMaybeRefresh, true);
    document.addEventListener('select', onMaybeRefresh, true);
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('input', onMaybeRefresh, true);
      document.removeEventListener('keyup', onMaybeRefresh, true);
      document.removeEventListener('click', onMaybeRefresh, true);
      document.removeEventListener('select', onMaybeRefresh, true);
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, [refresh]);

  if (isEmployerPublicAuthPath(pathname)) return null;
  if (!target || !active || !pos) return null;

  return (
    <div
      ref={tooltipRef}
      className="pointer-events-auto fixed z-[20000] max-w-[240px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 shadow-lg shadow-slate-900/10"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className="block w-full text-left text-[13px] font-medium leading-snug text-slate-900 hover:text-indigo-700"
        onClick={() => {
          const el = targetRef.current;
          if (!el || !active) return;
          if (isFieldEl(el)) {
            const next = applyWritingSpan(el.value, active);
            setNativeFieldValue(el, next);
            const caret = active.start + active.suggestion.length;
            window.requestAnimationFrame(() => {
              el.focus();
              try {
                el.setSelectionRange(caret, caret);
              } catch {
                /* some inputs ignore selection */
              }
              refresh(el);
            });
            return;
          }
          applyContentEditableSpan(el, active);
          window.requestAnimationFrame(() => refresh(el));
        }}
      >
        {active.suggestion}
      </button>
      {active.original !== active.suggestion ? (
        <p className="mt-0.5 truncate text-[10px] text-slate-400 line-through">{active.original}</p>
      ) : null}
    </div>
  );
}
