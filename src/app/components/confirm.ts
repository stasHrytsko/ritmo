export interface ConfirmOptions {
  title: string;
  body?: string;
  confirm: string;
  cancel?: string;
  /** Paints the confirm button as destructive. */
  danger?: boolean;
}

export interface Request extends ConfirmOptions {
  resolve: (answer: boolean | null) => void;
}

let show: ((request: Request) => void) | null = null;

/** Registered by ConfirmHost while it is mounted. */
export const setConfirmPresenter = (presenter: ((request: Request) => void) | null) => {
  show = presenter;
};

/**
 * An in-app replacement for window.confirm. Resolves true for the confirm
 * button, false for the cancel button, and null when the sheet is dismissed —
 * so a choice between two real options never defaults to one by accident.
 */
export function askConfirm(options: ConfirmOptions): Promise<boolean | null> {
  if (!show) return Promise.resolve(window.confirm([options.title, options.body].filter(Boolean).join('\n\n')));
  return new Promise((resolve) => show?.({ ...options, resolve }));
}

