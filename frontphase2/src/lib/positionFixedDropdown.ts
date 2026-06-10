/** Viewport-fixed dropdown coords anchored to a trigger (e.g. table row ⋮ menu). */
export function positionFixedDropdownFromTrigger(
  trigger: HTMLElement,
  menuWidth: number,
  options?: { gap?: number; margin?: number; estimatedHeight?: number },
): { top: number; left: number } {
  const gap = options?.gap ?? 6;
  const margin = options?.margin ?? 12;
  const estimatedHeight = options?.estimatedHeight ?? 320;
  const rect = trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = rect.right - menuWidth;
  left = Math.max(margin, Math.min(left, viewportWidth - menuWidth - margin));

  const spaceBelow = viewportHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;

  let top: number;
  if (spaceBelow >= spaceAbove) {
    top = rect.bottom + gap;
  } else {
    const height = Math.min(estimatedHeight, Math.max(spaceAbove, 120));
    top = rect.top - gap - height;
  }

  // Menu panels use max-h + internal scroll — only keep on-screen vertically.
  top = Math.max(margin, Math.min(top, viewportHeight - margin - 48));

  return { top, left };
}
