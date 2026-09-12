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

/** Stop Grammarly / LanguageTool from fighting React controlled inputs (eats first keystroke). */
function softDisableThirdPartyEditors(el: AssistEl) {
  const node = el as HTMLElement;
  if (node.dataset.writingAssistSoftened === '1') return;
  node.dataset.writingAssistSoftened = '1';
  node.setAttribute('data-gramm', 'false');
  node.setAttribute('data-gramm_editor', 'false');
  node.setAttribute('data-enable-grammarly', 'false');
  node.setAttribute('data-lt-active', 'false');
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
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [target, setTarget] = useState<AssistEl | null>(null);
  const [active, setActive] = useState<WritingSpanSuggestion | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [tipVisible, setTipVisible] = useState(false);

  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<AssistEl | null>(null);
  const tipVisibleRef = useRef(false);
  const ignoredIdsRef = useRef<Set<string>>(new Set());
  const lastShownIdRef = useRef<string | null>(null);
  const lastActivityRef = useRef(Date.now());
  const idleTimerRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const fieldKeyRef = useRef<string>('');
  const refreshRafRef = useRef<number | null>(null);
  const pendingRefreshElRef = useRef<AssistEl | null>(null);

  const IDLE_HIDE_MS = 2500;
  const SHOW_DEBOUNCE_MS = 320;

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current != null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (showTimerRef.current != null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (refreshRafRef.current != null) {
      window.cancelAnimationFrame(refreshRafRef.current);
      refreshRafRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    tipVisibleRef.current = false;
    setTarget(null);
    setActive(null);
    setPos(null);
    setTipVisible(false);
    targetRef.current = null;
    lastShownIdRef.current = null;
    pendingRefreshElRef.current = null;
  }, [clearTimers]);

  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  const isTooltipFocus = useCallback((node: EventTarget | Node | null) => {
    return Boolean(node instanceof Node && tooltipRef.current?.contains(node));
  }, []);

  const scheduleIdleHide = useCallback(() => {
    if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_HIDE_MS) {
        if (lastShownIdRef.current) ignoredIdsRef.current.add(lastShownIdRef.current);
        tipVisibleRef.current = false;
        setTipVisible(false);
        setActive(null);
        setPos(null);
        lastShownIdRef.current = null;
      }
      idleTimerRef.current = null;
    }, IDLE_HIDE_MS);
  }, []);

  const refreshNow = useCallback(
    (el: AssistEl | null) => {
      if (isEmployerPublicAuthPath(pathnameRef.current)) {
        dismissRef.current();
        return;
      }
      if (isTooltipFocus(document.activeElement)) return;

      if (!el || !el.isConnected) {
        dismissRef.current();
        return;
      }

      const focused =
        document.activeElement === el ||
        (document.activeElement instanceof Node && el.contains(document.activeElement));

      if (!focused) {
        dismissRef.current();
        return;
      }

      softDisableThirdPartyEditors(el);

      const fieldKey = `${el.tagName}:${(el as HTMLElement).id || ''}:${(el as HTMLElement).getAttribute('name') || ''}`;
      if (fieldKeyRef.current !== fieldKey) {
        fieldKeyRef.current = fieldKey;
        ignoredIdsRef.current.clear();
        lastShownIdRef.current = null;
      }

      lastActivityRef.current = Date.now();
      const { text, caret } = readAssistValue(el);
      const spans = getWritingSpanSuggestions(text, { max: 14 });

      for (const s of spans) {
        if (caret > s.end + 3) ignoredIdsRef.current.add(s.id);
        if (caret >= s.start && caret <= s.end) ignoredIdsRef.current.delete(s.id);
      }

      const eligible = spans.filter((s) => !ignoredIdsRef.current.has(s.id));
      const span = pickSpanNearCaret(eligible, caret);

      targetRef.current = el;
      setTarget((prev) => (prev === el ? prev : el));

      if (!span) {
        tipVisibleRef.current = false;
        setActive(null);
        setPos(null);
        setTipVisible(false);
        lastShownIdRef.current = null;
        return;
      }

      const place = () => {
        // Field may have blurred while the tip was debounced.
        if (targetRef.current !== el || !el.isConnected) return;
        const stillFocused =
          document.activeElement === el ||
          (document.activeElement instanceof Node && el.contains(document.activeElement));
        if (!stillFocused) return;

        const latest = readAssistValue(el);
        const anchor = Math.min(Math.max(span.end, 0), latest.text.length);
        const rect = isFieldEl(el) ? getCaretViewportRect(el, anchor) : contentEditableCaretRect(el, anchor);
        const tooltipW = 220;
        tipVisibleRef.current = true;
        setActive(span);
        setTipVisible(true);
        lastShownIdRef.current = span.id;
        setPos({
          left: Math.min(Math.max(8, rect.left), window.innerWidth - tooltipW - 8),
          top: Math.min(rect.top + rect.height + 6, window.innerHeight - 56),
        });
        scheduleIdleHide();
      };

      if (showTimerRef.current != null) window.clearTimeout(showTimerRef.current);
      if (lastShownIdRef.current === span.id && tipVisibleRef.current) {
        place();
      } else {
        tipVisibleRef.current = false;
        setTipVisible(false);
        setActive(null);
        setPos(null);
        showTimerRef.current = window.setTimeout(() => {
          place();
          showTimerRef.current = null;
        }, SHOW_DEBOUNCE_MS);
      }
    },
    [isTooltipFocus, scheduleIdleHide],
  );

  const scheduleRefresh = useCallback(
    (el: AssistEl | null) => {
      pendingRefreshElRef.current = el;
      if (refreshRafRef.current != null) return;
      // Defer until after React commits the controlled value so we never race the first keystroke.
      refreshRafRef.current = window.requestAnimationFrame(() => {
        refreshRafRef.current = null;
        const next = pendingRefreshElRef.current;
        pendingRefreshElRef.current = null;
        refreshNow(next);
      });
    },
    [refreshNow],
  );

  const refreshNowRef = useRef(refreshNow);
  refreshNowRef.current = refreshNow;
  const scheduleRefreshRef = useRef(scheduleRefresh);
  scheduleRefreshRef.current = scheduleRefresh;

  useEffect(() => {
    dismissRef.current();
  }, [pathname]);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = closestAssistable(e.target);
      if (el) {
        softDisableThirdPartyEditors(el);
        // Soft focus only — don't run suggestion logic until the user types (avoids first-key races).
        targetRef.current = el;
        setTarget((prev) => (prev === el ? prev : el));
        return;
      }
      if (!tooltipRef.current?.contains(e.target as Node)) dismissRef.current();
    };

    const onFocusOut = (e: FocusEvent) => {
      if (tooltipRef.current?.contains(e.relatedTarget as Node)) return;
      window.setTimeout(() => {
        const next = document.activeElement;
        if (tooltipRef.current?.contains(next)) return;
        const el = closestAssistable(next);
        if (el) {
          softDisableThirdPartyEditors(el);
          targetRef.current = el;
          setTarget((prev) => (prev === el ? prev : el));
          return;
        }
        dismissRef.current();
      }, 80);
    };

    const onInputOrSelect = (e: Event) => {
      const el = closestAssistable(e.target);
      if (el) {
        scheduleRefreshRef.current(el);
        return;
      }
      if (tooltipRef.current?.contains(e.target as Node)) return;
      const current = targetRef.current;
      if (!current || !(e.target instanceof Node) || !current.contains(e.target)) {
        dismissRef.current();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const el = closestAssistable(e.target);
      if (el) scheduleRefreshRef.current(el);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissRef.current();
    };

    const onViewport = () => {
      const el = targetRef.current;
      if (!el?.isConnected) {
        dismissRef.current();
        return;
      }
      if (!tipVisibleRef.current) return;
      refreshNowRef.current(el);
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    // Bubble phase (not capture) so React's onChange commits before we read the value.
    document.addEventListener('input', onInputOrSelect);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('select', onInputOrSelect);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('input', onInputOrSelect);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('select', onInputOrSelect);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, []);

  useEffect(() => {
    if (!target) return undefined;
    const checkStillOpen = () => {
      const el = targetRef.current;
      if (!el?.isConnected) {
        dismissRef.current();
        return;
      }
      const ae = document.activeElement;
      if (tooltipRef.current?.contains(ae)) return;
      if (ae !== el && !(ae instanceof Node && el.contains(ae))) {
        dismissRef.current();
      }
    };
    const id = window.setInterval(checkStillOpen, 400);
    return () => window.clearInterval(id);
  }, [target]);

  if (isEmployerPublicAuthPath(pathname)) return null;
  if (!target || !tipVisible || !active || !pos) return null;

  return (
    <div
      ref={tooltipRef}
      className="pointer-events-auto fixed z-[20000] max-w-[240px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 shadow-lg shadow-slate-900/10"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => {
        lastActivityRef.current = Date.now();
        scheduleIdleHide();
      }}
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
              refreshNowRef.current(el);
            });
            return;
          }
          applyContentEditableSpan(el, active);
          window.requestAnimationFrame(() => refreshNowRef.current(el));
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
