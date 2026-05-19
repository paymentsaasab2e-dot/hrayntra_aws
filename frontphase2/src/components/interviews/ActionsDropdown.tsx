import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, EllipsisVertical, Eye, MessageSquarePlus, Pencil, RotateCcw, Trash2, UserRoundX, XCircle } from 'lucide-react';
import { SHOW_TABLE_ROW_EDIT_ICON } from '../../constants/tableUi';

export type InterviewAction =
  | 'view'
  | 'edit'
  | 'reject'
  | 'reschedule'
  | 'cancel'
  | 'delete'
  | 'feedback'
  | 'copyLink'
  | 'noShow';

interface ActionsDropdownProps {
  onSelect: (action: InterviewAction) => void;
  actions?: InterviewAction[];
}

const actions: Array<{ key: InterviewAction; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'view', label: 'View Details', icon: Eye },
  { key: 'edit', label: 'Edit Interview', icon: Pencil },
  { key: 'reject', label: 'Reject Candidate', icon: XCircle },
  { key: 'reschedule', label: 'Reschedule', icon: RotateCcw },
  { key: 'cancel', label: 'Cancel Interview', icon: XCircle },
  { key: 'delete', label: 'Delete Interview', icon: Trash2 },
  { key: 'feedback', label: 'Submit Feedback', icon: MessageSquarePlus },
  { key: 'copyLink', label: 'Copy Meeting Link', icon: Copy },
  { key: 'noShow', label: 'Mark No Show', icon: UserRoundX },
];

export function ActionsDropdown({ onSelect, actions: allowedActions }: ActionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const MENU_WIDTH = 190;
  const MENU_GAP = 8;
  const VIEWPORT_MARGIN = 12;
  const visibleActions = (allowedActions?.length
    ? actions.filter((action) => allowedActions.includes(action.key))
    : actions
  ).filter((action) => SHOW_TABLE_ROW_EDIT_ICON || action.key !== 'edit');

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        (ref.current && ref.current.contains(target)) ||
        (menuRef.current && menuRef.current.contains(target))
      ) {
        return;
      }
      setOpen(false);
    };

    const handleScroll = () => {
      setOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spaceRight = viewportWidth - rect.right - VIEWPORT_MARGIN;
    const spaceLeft = rect.left - VIEWPORT_MARGIN;

    let left = rect.right + MENU_GAP;
    if (spaceRight < MENU_WIDTH && spaceLeft >= MENU_WIDTH) {
      left = rect.left - MENU_WIDTH - MENU_GAP;
    } else if (spaceRight < MENU_WIDTH) {
      left = Math.max(VIEWPORT_MARGIN, viewportWidth - MENU_WIDTH - VIEWPORT_MARGIN);
    }

    const top = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.top - 4),
      Math.max(VIEWPORT_MARGIN, viewportHeight - 220)
    );

    setMenuPosition({
      top,
      left: Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - MENU_WIDTH - VIEWPORT_MARGIN)),
    });
  }, [open]);

  if (!visibleActions.length) {
    return null;
  }

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

      {open && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[999] min-w-[190px] rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-lg"
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              {visibleActions.map(({ key, label, icon: Icon }) => (
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
