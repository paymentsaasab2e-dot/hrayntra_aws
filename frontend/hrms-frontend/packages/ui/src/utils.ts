import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const DS_TEXT_SIZES = [
  'ds-micro',
  'ds-caption',
  'ds-label',
  'ds-label-upper',
  'ds-body-xs',
  'ds-body-sm',
  'ds-body',
  'ds-heading-sm',
  'ds-heading',
  'ds-display',
] as const

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...DS_TEXT_SIZES] }],
    },
  },
})

/** Merge Tailwind classes safely — resolves conflicts correctly */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
