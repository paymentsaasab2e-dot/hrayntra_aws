import React from 'react';

/**
 * Inline WhatsApp glyph that mirrors the lucide-react icon API
 * (`size`, `className`, `strokeWidth`, plus any other SVG props).
 *
 * Phase 2 standardises on this icon for every UI element that opens a
 * WhatsApp chat / represents the WhatsApp channel (Send WhatsApp buttons,
 * row actions, activity-log entries, communication channel chips, etc.).
 *
 * The path is the canonical WhatsApp speech-bubble + receiver glyph rendered
 * with `currentColor` so existing emerald/slate Tailwind classes keep working.
 */
export interface WhatsAppIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'children'> {
  size?: number | string;
  strokeWidth?: number | string;
}

export const WhatsAppIcon = React.forwardRef<SVGSVGElement, WhatsAppIconProps>(
  ({ size = 16, strokeWidth: _strokeWidth, className, ...rest }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label="WhatsApp"
      className={className}
      {...rest}
    >
      <path d="M19.05 4.91A10 10 0 0 0 12 2 10 10 0 0 0 2.05 12a9.9 9.9 0 0 0 1.34 5L2 22l5.18-1.36A10 10 0 0 0 12 22a10 10 0 0 0 9.97-10 10 10 0 0 0-2.92-7.09Zm-7.05 15.4a8.32 8.32 0 0 1-4.24-1.16l-.3-.18-3.07.81.82-3-.2-.31a8.31 8.31 0 0 1-1.27-4.45A8.34 8.34 0 0 1 12 3.7a8.3 8.3 0 0 1 5.9 2.43A8.31 8.31 0 0 1 20.3 12a8.34 8.34 0 0 1-8.3 8.31Zm4.55-6.22c-.25-.13-1.48-.73-1.7-.81s-.4-.13-.56.13-.65.81-.79.97-.29.2-.54.07a6.83 6.83 0 0 1-2.01-1.24 7.55 7.55 0 0 1-1.39-1.73c-.15-.25 0-.39.11-.51.11-.11.25-.29.37-.43a1.7 1.7 0 0 0 .25-.41.46.46 0 0 0 0-.43c-.06-.13-.56-1.35-.77-1.85s-.41-.42-.56-.43h-.48a.92.92 0 0 0-.67.31 2.81 2.81 0 0 0-.88 2.09 4.88 4.88 0 0 0 1 2.59 11.2 11.2 0 0 0 4.3 3.81 14.8 14.8 0 0 0 1.43.53 3.45 3.45 0 0 0 1.58.1 2.59 2.59 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .15-1.2c-.06-.11-.22-.17-.47-.3Z" />
    </svg>
  )
);

WhatsAppIcon.displayName = 'WhatsAppIcon';

export default WhatsAppIcon;
