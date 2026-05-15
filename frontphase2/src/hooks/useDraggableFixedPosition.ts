'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type DraggablePoint = { x: number; y: number };

type DraggableSize = { width: number; height: number };

type UseDraggableFixedPositionOptions = {
  storageKey: string;
  size: DraggableSize;
  margin?: number;
  defaultPosition?: () => DraggablePoint;
  tapThresholdPx?: number;
  onTap?: () => void;
  /** When false, skip reading/writing localStorage (e.g. until measured). */
  enabled?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readStoredPosition(storageKey: string): DraggablePoint | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraggablePoint;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function useDraggableFixedPosition({
  storageKey,
  size,
  margin = 16,
  defaultPosition,
  tapThresholdPx = 10,
  onTap,
  enabled = true,
}: UseDraggableFixedPositionOptions) {
  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<DraggablePoint>({ x: margin, y: margin });

  const positionRef = useRef(position);
  const hasDraggedRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);

  positionRef.current = position;

  const clampPosition = useCallback(
    (x: number, y: number): DraggablePoint => {
      if (typeof window === 'undefined') return { x, y };
      const maxX = Math.max(margin, window.innerWidth - size.width - margin);
      const maxY = Math.max(margin, window.innerHeight - size.height - margin);
      return {
        x: clamp(x, margin, maxX),
        y: clamp(y, margin, maxY),
      };
    },
    [margin, size.height, size.width],
  );

  const persistPosition = useCallback(
    (next: DraggablePoint) => {
      if (!enabled) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [enabled, storageKey],
  );

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const stored = readStoredPosition(storageKey);
    const fallback = defaultPosition?.() ?? { x: margin, y: margin };
    const initial = clampPosition(stored ?? fallback);
    setPosition(initial);
    positionRef.current = initial;
    setMounted(true);
  }, [clampPosition, defaultPosition, enabled, margin, storageKey]);

  useEffect(() => {
    if (!mounted || !enabled) return;
    setPosition((prev) => {
      const next = clampPosition(prev.x, prev.y);
      positionRef.current = next;
      return next;
    });
  }, [clampPosition, enabled, mounted, size.height, size.width]);

  useEffect(() => {
    if (!mounted || !enabled) return;

    const onResize = () => {
      setPosition((prev) => {
        const next = clampPosition(prev.x, prev.y);
        positionRef.current = next;
        persistPosition(next);
        return next;
      });
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampPosition, enabled, mounted, persistPosition]);

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;

      if (!hasDraggedRef.current && Math.hypot(dx, dy) > tapThresholdPx) {
        hasDraggedRef.current = true;
      }

      if (!hasDraggedRef.current) return;

      const next = clampPosition(drag.originX + dx, drag.originY + dy);
      positionRef.current = next;
      setPosition(next);
    };

    const endDrag = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      if (!hasDraggedRef.current) {
        onTap?.();
      } else {
        persistPosition(positionRef.current);
      }

      setIsDragging(false);
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [clampPosition, isDragging, onTap, persistPosition, tapThresholdPx]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      hasDraggedRef.current = false;
      dragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originX: positionRef.current.x,
        originY: positionRef.current.y,
      };
      setIsDragging(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return {
    mounted,
    isDragging,
    position,
    setPosition: (next: DraggablePoint) => {
      const clamped = clampPosition(next.x, next.y);
      positionRef.current = clamped;
      setPosition(clamped);
      persistPosition(clamped);
    },
    dragHandleProps: {
      onPointerDown,
      style: { touchAction: 'none' as const, userSelect: 'none' as const },
    },
    style: {
      left: position.x,
      top: position.y,
      cursor: isDragging ? 'grabbing' : 'grab',
    },
  };
}
