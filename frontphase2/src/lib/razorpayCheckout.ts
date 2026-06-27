'use client';

export type RazorpayCheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayHandler = (response: RazorpayCheckoutResponse) => void;

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayCheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export type OpenRazorpayCheckoutInput = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  merchantName: string;
  description: string;
  merchantUpi?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (response: RazorpayCheckoutResponse) => void | Promise<void>;
  onDismiss?: () => void;
  onFailure?: (message: string) => void;
};

export async function openRazorpayCheckout(input: OpenRazorpayCheckoutInput): Promise<void> {
  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    throw new Error('Could not load Razorpay checkout. Check your internet connection.');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const rzp = new window.Razorpay!({
      key: input.keyId,
      amount: input.amount,
      currency: input.currency,
      name: input.merchantName,
      description: input.description,
      order_id: input.orderId,
      prefill: input.prefill,
      notes: {
        merchant_upi: input.merchantUpi || 'ghodehimanshu453-4@okicici',
      },
      theme: {
        color: '#072654',
      },
      config: {
        display: {
          blocks: {
            upi: {
              name: 'Pay via UPI',
              instruments: [{ method: 'upi' }],
            },
            card: {
              name: 'Cards',
              instruments: [{ method: 'card' }],
            },
            netbanking: {
              name: 'Netbanking',
              instruments: [{ method: 'netbanking' }],
            },
            wallet: {
              name: 'Wallets',
              instruments: [{ method: 'wallet' }],
            },
          },
          sequence: ['block.upi', 'block.card', 'block.netbanking', 'block.wallet'],
          preferences: {
            show_default_blocks: true,
          },
        },
      },
      handler: (response: RazorpayCheckoutResponse) => {
        finish(() => {
          void Promise.resolve(input.onSuccess(response))
            .then(() => resolve())
            .catch((err: unknown) => {
              reject(err instanceof Error ? err : new Error('Payment confirmation failed'));
            });
        });
      },
      modal: {
        ondismiss: () => {
          finish(() => {
            input.onDismiss?.();
            reject(new Error('Payment cancelled'));
          });
        },
      },
    });

    rzp.on('payment.failed', (response) => {
      finish(() => {
        const message = response?.error?.description || 'Payment failed';
        input.onFailure?.(message);
        reject(new Error(message));
      });
    });

    rzp.open();
  });
}

export function readCurrentUserPrefill(): { name?: string; email?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem('currentUser');
    if (!raw) return {};
    const user = JSON.parse(raw) as { name?: string; email?: string };
    return {
      name: user.name || undefined,
      email: user.email || undefined,
    };
  } catch {
    return {};
  }
}
