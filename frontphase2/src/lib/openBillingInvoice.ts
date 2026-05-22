import React from 'react';
import { apiGetBillingRecord, apiGetBillingSettings } from './api';
import { invoiceFromBillingRecord } from './invoiceFromBillingRecord';
import { RecruitmentInvoicePreview } from '../components/billing/RecruitmentInvoicePreview';
import { generateInvoicePdfBlobFromComponent } from '../utils/generateInvoicePdf';
import { buildFileHref } from '../utils/cloudinaryUrls';

function uploadsBaseFromEnv(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
  return apiBase.replace(/\/api\/v1\/?$/, '');
}

const POPUP_BLOCKED_MESSAGE =
  'Your browser blocked the invoice tab. Allow pop-ups for this site, then try again.';

/** Open a blank tab immediately (must run in the same turn as the user click). */
export function openInvoicePreviewTab(): Window {
  const win = window.open('about:blank', '_blank');
  if (!win) {
    throw new Error(POPUP_BLOCKED_MESSAGE);
  }
  try {
    win.document.title = 'Invoice';
    win.document.body.innerHTML =
      '<p style="font-family:system-ui,sans-serif;padding:24px;color:#334155">Preparing invoice PDF…</p>';
  } catch {
    // Ignore if the blank document is not writable in some browsers.
  }
  return win;
}

function openUrlViaAnchor(url: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function navigatePreviewTab(win: Window, url: string) {
  if (win.closed) {
    throw new Error('The invoice tab was closed before the file could load.');
  }
  win.location.href = url;
}

/**
 * Open the billing invoice PDF in a new browser tab.
 * Pass `previewWindow` from openInvoicePreviewTab() when generating a PDF so the tab
 * opens synchronously on click (avoids pop-up blockers after async work).
 */
export async function openBillingInvoiceInNewTab(
  invoiceId: string,
  invoiceUrl?: string | null,
  previewWindow?: Window | null
): Promise<void> {
  const storedUrl = String(invoiceUrl || '').trim();
  if (storedUrl) {
    const href = buildFileHref(storedUrl, uploadsBaseFromEnv());
    if (previewWindow && !previewWindow.closed) {
      navigatePreviewTab(previewWindow, href);
    } else {
      openUrlViaAnchor(href);
    }
    return;
  }

  const win =
    previewWindow && !previewWindow.closed ? previewWindow : openInvoicePreviewTab();

  try {
    const [settingsRes, recordRes] = await Promise.all([
      apiGetBillingSettings(),
      apiGetBillingRecord(invoiceId),
    ]);
    const settings = settingsRes.data;
    const record = recordRes.data;
    if (!settings || !record) {
      throw new Error('Invoice details could not be loaded');
    }

    const payload = (record.invoicePayload || {}) as Record<string, unknown>;
    const hasLines =
      Array.isArray(payload.lineItems) && (payload.lineItems as unknown[]).length > 0;
    if (!hasLines && !Number(record.amount)) {
      throw new Error('No invoice document is available for this record yet');
    }

    const invoice = invoiceFromBillingRecord(record, settings);
    const blob = await generateInvoicePdfBlobFromComponent(
      React.createElement(RecruitmentInvoicePreview, { invoice, settings }),
    );
    const objectUrl = URL.createObjectURL(blob);
    navigatePreviewTab(win, objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
  } catch (error) {
    if (!previewWindow && !win.closed) {
      win.close();
    }
    throw error;
  }
}
