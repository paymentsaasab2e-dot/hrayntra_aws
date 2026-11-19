// =============================================================================
// @hryantra/ui — Shared Scroll Lock Utility
//
// Used by ModalWrapper and DrawerWrapper to prevent the scroll-lock race
// condition that occurs when multiple overlays are stacked.
//
// If Modal opens, then Drawer opens inside it:
//   lockScroll() → count=1 → overflow=hidden
//   lockScroll() → count=2 → already hidden, no-op
//   Drawer closes: unlockScroll() → count=1 → still hidden ✅
//   Modal closes:  unlockScroll() → count=0 → overflow restored ✅
//
// Without this: closing the modal would reset overflow while drawer is still open.
// =============================================================================

let _scrollLockCount = 0

export function lockScroll(): void {
  _scrollLockCount++
  if (_scrollLockCount === 1) {
    document.body.style.overflow = 'hidden'
  }
}

export function unlockScroll(): void {
  _scrollLockCount = Math.max(0, _scrollLockCount - 1)
  if (_scrollLockCount === 0) {
    document.body.style.overflow = ''
  }
}
