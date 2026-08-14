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

  const spans = useMemo(() => getWritingSpanSuggestions(value, { max: 14 }), [value]);

  const refresh = useCallback(() => {
    const el = inputRef.current;
    if (!el || !focused) {
      setActive(null);
      setPos(null);
      return;
    }
    const nextCaret = el.selectionStart ?? caret;
    setCaret(nextCaret);
    const span = pickSpanNearCaret(spans, nextCaret);
    setActive(span);
    if (!span) {
      setPos(null);
      return;
    }
    // Anchor tooltip under the issue end (Grammarly-like, near the word)
    const anchor = Math.min(Math.max(span.end, 0), value.length);
    const rect = getCaretViewportRect(el, anchor);
    const tooltipW = 220;
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - tooltipW - 8,
    );
    const top = Math.min(rect.top + rect.height + 6, window.innerHeight - 56);
    setPos({ top, left });
  }, [caret, focused, inputRef, spans, value.length]);

  useLayoutEffect(() => {
    refresh();
  }, [refresh, value, caret, focused]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const onFocus = () => setFocused(true);
    const onBlur = () => {
      // Delay so click on tooltip can fire first
      window.setTimeout(() => setFocused(false), 140);
    };
    const onSelect = () => {
      setCaret(el.selectionStart ?? 0);
      refresh();
    };
    const onScroll = () => refresh();
    const onResize = () => refresh();

    el.addEventListener('focus', onFocus);
    el.addEventListener('blur', onBlur);
    el.addEventListener('keyup', onSelect);
    el.addEventListener('click', onSelect);
    el.addEventListener('select', onSelect);
    el.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);

    return () => {
      el.removeEventListener('focus', onFocus);
      el.removeEventListener('blur', onBlur);
      el.removeEventListener('keyup', onSelect);
      el.removeEventListener('click', onSelect);
      el.removeEventListener('select', onSelect);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [inputRef, refresh]);

  return { active, pos, focused, spans };
}

type TooltipProps = {
  inputRef: React.RefObject<FieldEl | null>;
  value: string;
  onApply: (next: string) => void;
};

/** Floating caret tooltip — shows only the corrected wording. */
export function WritingAssistTooltip({ inputRef, value, onApply }: TooltipProps) {
  const { active, pos, focused } = useWritingAssistTooltip(inputRef, value);
  if (!focused || !active || !pos) return null;

  return (
    <div
      className="pointer-events-auto fixed z-[9999] max-w-[240px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 shadow-lg shadow-slate-900/10"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className="block w-full text-left text-[13px] font-medium leading-snug text-slate-900 hover:text-[#0A66C2]"
        onClick={() => {
          const next = applyWritingSpan(value, active);
          onApply(next);
          const el = inputRef.current;
          if (el) {
            const caret = active.start + active.suggestion.length;
            window.requestAnimationFrame(() => {
              el.focus();
              el.setSelectionRange(caret, caret);
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
        <WritingAssistTooltip
          inputRef={localRef}
          value={value}
          onApply={onChange}
        />
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
      <WritingAssistTooltip
        inputRef={localRef}
        value={value}
        onApply={onChange}
      />
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
