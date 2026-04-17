import type { EmploymentType, PlacementStatus } from '../types/placement';

export function getStatusBadgeStyle(status: PlacementStatus) {
  switch (status) {
    case 'JOINING_SCHEDULED':
      return { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]' };
    case 'JOINED':
      return { bg: 'bg-[#D1FAE5]', text: 'text-[#065F46]' };
    case 'OFFER_ACCEPTED':
      return { bg: 'bg-[#DBEAFE]', text: 'text-[#1E40AF]' };
    case 'NO_SHOW':
    case 'FAILED':
      return { bg: 'bg-[#FEE2E2]', text: 'text-[#991B1B]' };
    case 'WITHDRAWN':
      return { bg: 'bg-[#F3F4F6]', text: 'text-[#374151]' };
    case 'REPLACEMENT_REQUIRED':
      return { bg: 'bg-[#EDE9FE]', text: 'text-[#5B21B6]' };
    case 'REPLACED':
      return { bg: 'bg-[#DCFCE7]', text: 'text-[#166534]' };
    default:
      return { bg: 'bg-[#F3F4F6]', text: 'text-[#374151]' };
  }
}

export function getEmploymentTypeBadgeStyle(type?: EmploymentType | null) {
  switch (type) {
    case 'PERMANENT':
      return { bg: 'bg-[#F1F5F9]', text: 'text-[#475569]' };
    case 'CONTRACT':
      return { bg: 'bg-[#CCFBF1]', text: 'text-[#0F766E]' };
    case 'FREELANCE':
      return { bg: 'bg-[#FEF9C3]', text: 'text-[#854D0E]' };
    default:
      return { bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]' };
  }
}

export function formatCurrency(amount?: number | null) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatPlacementDate(date?: string | Date | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function calculatePlacementFee(salary: number, pct: number) {
  if (!salary || !pct) return 0;
  return (salary * pct) / 100;
}

export function getPlacementStatusLabel(status: PlacementStatus) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
