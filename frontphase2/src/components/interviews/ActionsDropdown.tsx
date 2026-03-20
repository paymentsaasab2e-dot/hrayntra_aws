import React, { useEffect, useRef, useState } from 'react';
import { Copy, EllipsisVertical, Eye, MessageSquarePlus, Pencil, RotateCcw, UserRoundX, XCircle } from 'lucide-react';

export type InterviewAction =
  | 'view'
  | 'edit'
  | 'reschedule'
  | 'cancel'
  | 'feedback'
  | 'copyLink'
  | 'noShow';

interface ActionsDropdownProps {
  onSelect: (action: InterviewAction) => void;
}

const actions: Array<{ key: InterviewAction; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'view', label: 'View Details', icon: Eye },
  { key: 'edit', label: 'Edit Interview', icon: Pencil },
  { key: 'reschedule', label: 'Reschedule', icon: RotateCcw },
  { key: 'cancel', label: 'Cancel Interview', icon: XCircle },
  { key: 'feedback', label: 'Submit Feedback', icon: MessageSquarePlus },
  { key: 'copyLink', label: 'Copy Meeting Link', icon: Copy },
  { key: 'noShow', label: 'Mark No Show', icon: UserRoundX },
];

export function ActionsDropdown({ onSelect }: ActionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
      >
        <EllipsisVertical className="size-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-20 min-w-[190px] rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-lg">
          {actions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(key);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#F9FAFB]"
            >
              <Icon className="size-4 text-[#6B7280]" />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
