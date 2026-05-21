'use client';

import React from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

async function renderInvoicePdfBlob(element: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf.output('blob');
}

export async function generateInvoicePdfBlobFromElement(element: HTMLElement): Promise<Blob> {
  return renderInvoicePdfBlob(element);
}

export async function generateInvoicePdfFromElement(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const blob = await renderInvoicePdfBlob(element);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Mount a React preview node off-screen, render to PDF, then unmount. */
export async function generateInvoicePdfFromComponent(
  component: React.ReactElement,
  filename: string,
): Promise<void> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '794px';
  host.style.background = '#fff';
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(component);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const target = host.firstElementChild as HTMLElement | null;
  if (!target) {
    root.unmount();
    host.remove();
    throw new Error('Invoice preview failed to render for PDF export');
  }

  try {
    await generateInvoicePdfFromElement(target, filename);
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Render invoice React preview off-screen and return a PDF blob (for email attachment). */
export async function generateInvoicePdfBlobFromComponent(
  component: React.ReactElement,
): Promise<Blob> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '794px';
  host.style.background = '#fff';
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(component);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const target = host.firstElementChild as HTMLElement | null;
  if (!target) {
    root.unmount();
    host.remove();
    throw new Error('Invoice preview failed to render for PDF export');
  }

  try {
    return await generateInvoicePdfBlobFromElement(target);
  } finally {
    root.unmount();
    host.remove();
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generateInvoicePdfBase64FromElement(element: HTMLElement): Promise<string> {
  const blob = await generateInvoicePdfBlobFromElement(element);
  return blobToBase64(blob);
}
