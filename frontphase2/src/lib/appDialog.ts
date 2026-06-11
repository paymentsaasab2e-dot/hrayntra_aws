export const APP_DIALOG_EVENT = 'app:dialog';

/** Branded title for in-app confirm / alert dialogs (replaces native browser prompts). */
export const SYSTEM_ALERT_TITLE = 'HRYANTRA';

export type AppDialogKind = 'alert' | 'confirm';
export type AppDialogTone = 'info' | 'success' | 'warning' | 'error';

export type AppDialogOptions = {
  tone?: AppDialogTone;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type AppDialogRequestDetail = {
  kind: AppDialogKind;
  message: string;
  tone: AppDialogTone;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (result: boolean) => void;
};

function toMessage(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof Error) return input.message;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function requestDialog(kind: AppDialogKind, message: unknown, options: AppDialogOptions = {}): Promise<boolean> {
  if (typeof window === 'undefined') {
    return Promise.resolve(kind === 'alert');
  }

  return new Promise<boolean>((resolve) => {
    const detail: AppDialogRequestDetail = {
      kind,
      message: toMessage(message ?? ''),
      tone: options.tone || 'info',
      title: options.title,
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      resolve,
    };

    window.dispatchEvent(new CustomEvent<AppDialogRequestDetail>(APP_DIALOG_EVENT, { detail }));
  });
}

export async function requestAlert(message: unknown, options: AppDialogOptions = {}): Promise<void> {
  await requestDialog('alert', message, options);
}

export function requestConfirm(message: unknown, options: AppDialogOptions = {}): Promise<boolean> {
  return requestDialog('confirm', message, options);
}

export async function requestSuccess(message: unknown, options: Omit<AppDialogOptions, 'tone'> = {}): Promise<void> {
  await requestAlert(message, { ...options, tone: 'success' });
}

export async function requestWarning(message: unknown, options: Omit<AppDialogOptions, 'tone'> = {}): Promise<void> {
  await requestAlert(message, { ...options, tone: 'warning' });
}

export async function requestError(message: unknown, options: Omit<AppDialogOptions, 'tone'> = {}): Promise<void> {
  await requestAlert(message, { ...options, tone: 'error' });
}

export async function requestInfo(message: unknown, options: Omit<AppDialogOptions, 'tone'> = {}): Promise<void> {
  await requestAlert(message, { ...options, tone: 'info' });
}
