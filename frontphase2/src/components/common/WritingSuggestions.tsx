'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type TextareaHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import {
  applyWritingSpan,
  getCaretViewportRect,
  getWritingSpanSuggestions,
  pickSpanNearCaret,
  type WritingSpanSuggestion,
} from '@/lib/writing-assist';

type FieldEl = HTMLTextAreaElement | HTMLInputElement;

/** Hide unused tip quickly; Grammarly-style assist only while editing that word. */
const IDLE_HIDE_MS = 2500;
const SHOW_DEBOUNCE_MS = 280;

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as { current: T | null }).current = node;
    }
  };
}

function useWritingAssistTooltip(inputRef: React.RefObject<FieldEl | null>, value: string) {
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [active, setActive] = useState<WritingSpanSuggestion | null>(null);
  const [tipVisible, setTipVisible] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const idleTimerRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  /** Spans the user typed past without applying — do not re-show until caret re-enters. */
  const ignoredIdsRef = useRef<Set<string>>(new Set());
  const lastShownIdRef = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current != null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (showTimerRef.current != null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const hideTip = useCallback(() => {
    setTipVisible(false);
    setActive(null);
    setPos(null);
    lastShownIdRef.current = null;
  }, []);

  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const scheduleIdleHide = useCallback(() => {
    if (idleTimerRef.current != null) {
      window.clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = window.setTimeout(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_HIDE_MS) {
        // User ignored the tip — remember this span so it doesn't stick on word 1.
        if (lastShownIdRef.current) {
          ignoredIdsRef.current.add(lastShownIdRef.current);
        }
        hideTip();
      }
      idleTimerRef.current = null;
    }, IDLE_HIDE_MS);
  }, [hideTip]);

  const spans = useMemo(() => getWritingSpanSuggestions(value, { max: 14 }), [value]);

  const refresh = useCallback(() => {
    const el = inputRef.current;
    if (!el || !focused) {
      hideTip();
      return;
    }

    const nextCaret = el.selectionStart ?? caret;
    setCaret(nextCaret);

    // Mark older issues as ignored once the user has typed past them.
    for (const s of spans) {
      if (nextCaret > s.end + 3) {
        ignoredIdsRef.current.add(s.id);
      }
    }
    // If caret returns into an issue, allow it again.
    for (const s of spans) {
      if (nextCaret >= s.start && nextCaret <= s.end) {
        ignoredIdsRef.current.delete(s.id);
      }
    }

    const eligible = spans.filter((s) => !ignoredIdsRef.current.has(s.id));
    const span = pickSpanNearCaret(eligible, nextCaret);
    if (!span) {
      hideTip();
      return;
    }

    const place = () => {
      const anchor = Math.min(Math.max(span.end, 0), value.length);
      const rect = getCaretViewportRect(el, anchor);
      const tooltipW = 220;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - tooltipW - 8);
      const top = Math.min(rect.top + rect.height + 6, window.innerHeight - 56);
      setActive(span);
      setPos({ top, left });
      setTipVisible(true);
      lastShownIdRef.current = span.id;
      scheduleIdleHide();
    };

    // Debounce show so the tip follows live typing instead of flashing on every key.
    if (showTimerRef.current != null) {
      window.clearTimeout(showTimerRef.current);
    }
    // Same active word → update immediately; new word → short debounce.
    if (lastShownIdRef.current === span.id && tipVisible) {
      place();
    } else {
      setTipVisible(false);
      setActive(null);
      setPos(null);
      showTimerRef.current = window.setTimeout(() => {
        place();
        showTimerRef.current = null;
      }, SHOW_DEBOUNCE_MS);
    }
  }, [caret, focused, hideTip, inputRef, scheduleIdleHide, spans, tipVisible, value.length]);

  useLayoutEffect(() => {
    refresh();
  }, [refresh, value, caret, focused]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const onFocus = () => {
      bumpActivity();
      setFocused(true);
    };
    const onBlur = () => {
      window.setTimeout(() => {
        setFocused(false);
        hideTip();
      }, 140);
    };
    const onActivity = () => {
      bumpActivity();
      setCaret(el.selectionStart ?? 0);
      scheduleIdleHide();
      refresh();
    };
    const onScroll = () => {
      if (tipVisible) refresh();
    };

    el.addEventListener('focus', onFocus);
    el.addEventListener('blur', onBlur);
    el.addEventListener('keyup', onActivity);
    el.addEventListener('keydown', bumpActivity);
    el.addEventListener('input', onActivity);
    el.addEventListener('click', onActivity);
    el.addEventListener('select', onActivity);
    el.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);

    return () => {
      el.removeEventListener('focus', onFocus);
      el.removeEventListener('blur', onBlur);
      el.removeEventListener('keyup', onActivity);
      el.removeEventListener('keydown', bumpActivity);
      el.removeEventListener('input', onActivity);
      el.removeEventListener('click', onActivity);
      el.removeEventListener('select', onActivity);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
      clearTimers();
    };
  }, [bumpActivity, clearTimers, hideTip, inputRef, refresh, scheduleIdleHide, tipVisible]);

  useEffect(() => {
    if (!focused) {
      ignoredIdsRef.current.clear();
      clearTimers();
    }
  }, [clearTimers, focused]);

  return { active, pos, focused, tipVisible, bumpActivity, scheduleIdleHide };
}

type TooltipProps = {
  inputRef: React.RefObject<FieldEl | null>;
  value: string;
  onApply: (next: string) => void;
};

/** Floating caret tooltip — shows only the corrected wording near the caret. */
export function WritingAssistTooltip({ inputRef, value, onApply }: TooltipProps) {
  const { active, pos, focused, tipVisible, bumpActivity, scheduleIdleHide } = useWritingAssistTooltip(
    inputRef,
    value,
  );
  if (!focused || !tipVisible || !active || !pos) return null;

  return (
    <div
      className="pointer-events-auto fixed z-[9999] max-w-[240px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 shadow-lg shadow-slate-900/10"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => {
        bumpActivity();
        scheduleIdleHide();
      }}
      onPointerDown={() => {
        bumpActivity();
        scheduleIdleHide();
      }}
    >
      <button
        type="button"
        className="block w-full text-left text-[13px] font-medium leading-snug text-slate-900 hover:text-[#176F96]"
        onClick={() => {
          bumpActivity();
          const next = applyWritingSpan(value, active);
          onApply(next);
          const el = inputRef.current;
          if (el) {
            const nextCaret = active.start + active.suggestion.length;
            window.requestAnimationFrame(() => {
              el.focus();
              el.setSelectionRange(nextCaret, nextCaret);
            });
          }
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

type CommonProps = {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  wrapperClassName?: string;
  /** Optional underline markers under issues (dense Grammarly-like). */
  showMarks?: boolean;
};

type TextareaProps = CommonProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'children'> & {
    multiline?: true;
    inputRef?: Ref<HTMLTextAreaElement>;
  };

type InputProps = CommonProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'children'> & {
    multiline: false;
    inputRef?: Ref<HTMLInputElement>;
  };

/**
 * Drop-in field with Grammarly-style caret suggestions.
 * Tooltip shows the corrected phrase only — no “refine” labels.
 */
export function WritingAssistField(props: TextareaProps | InputProps) {
  const localRef = useRef<FieldEl | null>(null);
  const { value, onChange, className, wrapperClassName, showMarks = true } = props;

  const spans = useMemo(() => getWritingSpanSuggestions(value, { max: 18 }), [value]);

  const marks = showMarks && spans.length > 0 ? (
    <span className="pointer-events-none absolute bottom-1.5 right-2 flex gap-0.5" aria-hidden>
      {spans.slice(0, 6).map((s) => (
        <span
          key={s.id}
          className={`h-1 w-1 rounded-full ${
            s.kind === 'spelling'
              ? 'bg-rose-500'
              : s.kind === 'grammar'
                ? 'bg-amber-500'
                : s.kind === 'punctuation'
                  ? 'bg-emerald-500'
                  : 'bg-sky-500'
          }`}
          title={s.suggestion}
        />
      ))}
    </span>
  ) : null;

  if (props.multiline === false) {
    const {
      multiline: _m,
      inputRef,
      showMarks: _s,
      wrapperClassName: _w,
      onChange: _o,
      value: _v,
      ...rest
    } = props;
    return (
      <div className={`relative ${wrapperClassName || ''}`}>
        <input
          {...rest}
          ref={mergeRefs(localRef as Ref<HTMLInputElement>, inputRef)}
          value={value}
          spellCheck
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
        {marks}
        <WritingAssistTooltip inputRef={localRef} value={value} onApply={onChange} />
      </div>
    );
  }

  const {
    multiline: _m,
    inputRef,
    showMarks: _s,
    wrapperClassName: _w,
    onChange: _o,
    value: _v,
    ...rest
  } = props as TextareaProps;
  return (
    <div className={`relative ${wrapperClassName || ''}`}>
      <textarea
        {...rest}
        ref={mergeRefs(localRef as Ref<HTMLTextAreaElement>, inputRef)}
        value={value}
        spellCheck
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
      {marks}
      <WritingAssistTooltip inputRef={localRef} value={value} onApply={onChange} />
    </div>
  );
}

/** Back-compat shim: attach tooltip to an existing field via ref (no card UI). */
export function WritingSuggestions({
  value,
  onApply,
  inputRef,
}: {
  value: string;
  onApply: (next: string) => void;
  inputRef?: React.RefObject<FieldEl | null>;
  label?: string;
  max?: number;
  compact?: boolean;
}) {
  const fallbackRef = useRef<FieldEl | null>(null);
  const ref = inputRef || fallbackRef;
  if (!inputRef) return null;
  return <WritingAssistTooltip inputRef={ref} value={value} onApply={onApply} />;
}

export function WritingAssistHint({ children }: { children?: ReactNode }) {
  return children ? <>{children}</> : null;
}
