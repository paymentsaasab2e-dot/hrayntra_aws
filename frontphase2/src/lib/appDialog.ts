export const APP_DIALOG_EVENT = 'app:dialog';
/** Clears pending corner/modal dialogs (e.g. on tenant switch / logout). */
export const APP_DIALOG_FLUSH_EVENT = 'app:dialog-flush';

/** Branded title for in-app confirm / alert dialogs (replaces native browser prompts). */
export const SYSTEM_ALERT_TITLE = 'HRYANTRA';

export type AppDialogKind = 'alert' | 'confirm' | 'prompt';
export type AppDialogTone = 'info' | 'success' | 'warning' | 'error';
/** modal = centered overlay · corner = bottom-right toast queue (one by one) */
export type AppDialogPlacement = 'modal' | 'corner';

export type AppDialogOptions = {
  tone?: AppDialogTone;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placement?: AppDialogPlacement;
  /** Auto-dismiss corner alerts after ms (alert kind only). */
  autoCloseMs?: number;
  /** high = show immediately, even if corner toasts are already queued. */
  priority?: 'normal' | 'high';
  /** Initial value for prompt dialogs. */
  defaultValue?: string;
  /** Placeholder for prompt input. */
  inputPlaceholder?: string;
};

export type AppDialogRequestDetail = {
  kind: AppDialogKind;
  message: string;
  tone: AppDialogTone;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placement: AppDialogPlacement;
  autoCloseMs?: number;
  priority?: 'normal' | 'high';
  defaultValue?: string;
  inputPlaceholder?: string;
  resolve: (result: boolean) => void;
  /** Used by prompt dialogs — null when cancelled. */
  resolvePrompt?: (value: string | null) => void;
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
      placement: options.placement || 'modal',
      autoCloseMs: options.autoCloseMs,
      priority: options.priority || 'normal',
      defaultValue: options.defaultValue,
      inputPlaceholder: options.inputPlaceholder,
      resolve,
    };

    window.dispatchEvent(new CustomEvent<AppDialogRequestDetail>(APP_DIALOG_EVENT, { detail }));
  });
}

/** Drop any queued / active app dialogs and resolve them as cancelled. */
export function flushAppDialogs() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_DIALOG_FLUSH_EVENT));
}

export async function requestAlert(message: unknown, options: AppDialogOptions = {}): Promise<void> {
  await requestDialog('alert', message, options);
}

export function requestConfirm(message: unknown, options: AppDialogOptions = {}): Promise<boolean> {
  return requestDialog('confirm', message, options);
}

/** In-app text prompt (replaces window.prompt). Returns null when cancelled. */
export function requestPrompt(
  message: unknown,
  options: AppDialogOptions = {},
): Promise<string | null> {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise<string | null>((resolve) => {
    const detail: AppDialogRequestDetail = {
      kind: 'prompt',
      message: toMessage(message ?? ''),
      tone: options.tone || 'info',
      title: options.title || SYSTEM_ALERT_TITLE,
      confirmLabel: options.confirmLabel || 'OK',
      cancelLabel: options.cancelLabel || 'Cancel',
      placement: 'modal',
      autoCloseMs: options.autoCloseMs,
      priority: options.priority || 'normal',
      defaultValue: options.defaultValue ?? '',
      inputPlaceholder: options.inputPlaceholder,
      resolve: () => {},
      resolvePrompt: resolve,
    };

    window.dispatchEvent(new CustomEvent<AppDialogRequestDetail>(APP_DIALOG_EVENT, { detail }));
  });
}

/** Corner toast alert — queues and shows one by one in the bottom-right. */
export async function requestCornerAlert(
  message: unknown,
  options: Omit<AppDialogOptions, 'placement'> = {},
): Promise<void> {
  await requestAlert(message, {
    ...options,
    placement: 'corner',
    autoCloseMs: options.autoCloseMs ?? 6500,
  });
}

/** Corner confirm — one by one in the bottom-right. */
export function requestCornerConfirm(
  message: unknown,
  options: Omit<AppDialogOptions, 'placement'> = {},
): Promise<boolean> {
  return requestConfirm(message, { ...options, placement: 'corner' });
}

export async function requestSuccess(message: unknown, options: Omit<AppDialogOptions, 'tone'> = {}): Promise<void> {
  await requestAlert(message, { ...options, tone: 'success' });
}

export async function requestWarning(message: unknown, options: Omit<AppDialogOptions, 'tone'> = {}): Promise<void> {
  await requestAlert(message, { ...options, tone: 'warning' });
}

export async function requestError(
  message: unknown,
  options: Omit<AppDialogOptions, 'tone'> | string = {},
): Promise<void> {
  const fallback = typeof options === 'string' ? options : '';
  const dialogOptions = typeof options === 'string' ? {} : options;
  const text =
    message instanceof Error
      ? message.message || fallback
      : typeof message === 'string' && message.trim()
        ? message
        : fallback || message;
  await requestAlert(text, { ...dialogOptions, tone: 'error' });
}

export async function requestInfo(message: unknown, options: Omit<AppDialogOptions, 'tone'> = {}): Promise<void> {
  await requestAlert(message, { ...options, tone: 'info' });
}
