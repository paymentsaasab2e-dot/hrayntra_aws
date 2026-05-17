'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
} from 'lucide-react';

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
};

type ToolbarButtonProps = {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarButton({ title, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-200/80 hover:text-slate-900"
    >
      {children}
    </button>
  );
}

function runCommand(command: string, value?: string) {
  try {
    document.execCommand(command, false, value);
  } catch {
    /* ignore unsupported commands */
  }
}

function normalizeHtml(html: string) {
  const trimmed = html.trim();
  if (!trimmed || trimmed === '<br>' || trimmed === '<div><br></div>') return '';
  return html;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter job description…',
  className = '',
  minHeight = 280,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el || syncingRef.current) return;
    onChange(normalizeHtml(el.innerHTML));
  }, [onChange]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const next = value || '';
    if (el.innerHTML === next) return;
    syncingRef.current = true;
    el.innerHTML = next;
    syncingRef.current = false;
  }, [value]);

  const apply = useCallback(
    (command: string, arg?: string) => {
      editorRef.current?.focus();
      runCommand(command, arg);
      emitChange();
    },
    [emitChange],
  );

  const applyBlock = useCallback(
    (tag: string) => {
      editorRef.current?.focus();
      const block = tag.startsWith('<') ? tag : `<${tag}>`;
      runCommand('formatBlock', block);
      emitChange();
    },
    [emitChange],
  );

  const insertLink = useCallback(() => {
    const url = window.prompt('Enter URL', 'https://');
    if (!url?.trim()) return;
    apply('createLink', url.trim());
  }, [apply]);

  return (
    <div
      className={`job-rich-text-editor overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}
      style={{ ['--rte-min-height' as string]: `${minHeight}px` }}
    >
      <div className="job-rte-toolbar flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <select
          title="Heading"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) applyBlock('p');
            else applyBlock(v);
            e.target.value = '';
          }}
          className="mr-1 h-8 max-w-[7.5rem] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
        >
          <option value="" disabled>
            Format
          </option>
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        <ToolbarButton title="Bold" onClick={() => apply('bold')}>
          <Bold size={15} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => apply('italic')}>
          <Italic size={15} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton title="Underline" onClick={() => apply('underline')}>
          <Underline size={15} strokeWidth={2.5} />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />

        <ToolbarButton title="Bullet list" onClick={() => apply('insertUnorderedList')}>
          <List size={15} strokeWidth={2.25} />
        </ToolbarButton>
        <ToolbarButton title="Numbered list" onClick={() => apply('insertOrderedList')}>
          <ListOrdered size={15} strokeWidth={2.25} />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />

        <ToolbarButton title="Align left" onClick={() => apply('justifyLeft')}>
          <AlignLeft size={15} strokeWidth={2.25} />
        </ToolbarButton>
        <ToolbarButton title="Align center" onClick={() => apply('justifyCenter')}>
          <AlignCenter size={15} strokeWidth={2.25} />
        </ToolbarButton>
        <ToolbarButton title="Align right" onClick={() => apply('justifyRight')}>
          <AlignRight size={15} strokeWidth={2.25} />
        </ToolbarButton>
        <ToolbarButton title="Justify" onClick={() => apply('justifyFull')}>
          <AlignJustify size={15} strokeWidth={2.25} />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />

        <ToolbarButton title="Insert link" onClick={insertLink}>
          <LinkIcon size={15} strokeWidth={2.25} />
        </ToolbarButton>
        <ToolbarButton title="Clear formatting" onClick={() => apply('removeFormat')}>
          <RemoveFormatting size={15} strokeWidth={2.25} />
        </ToolbarButton>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        className="job-rte-editor min-h-[var(--rte-min-height,280px)] bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none ring-0"
        style={{ minHeight }}
      />
    </div>
  );
}
