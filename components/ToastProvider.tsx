import React, { createContext, useCallback, useContext, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (options: { message: string; type?: ToastType; durationMs?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    ({ message, type = 'info', durationMs = 3500 }: { message: string; type?: ToastType; durationMs?: number }) => {
      const id = Date.now() + Math.random();
      const toast: Toast = { id, type, message };
      setToasts((prev) => [...prev, toast]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    []
  );

  const handleDismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map((toast) => {
          const baseClasses =
            'flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg text-sm border bg-white/95 backdrop-blur';
          const typeClasses =
            toast.type === 'success'
              ? 'border-emerald-200 text-emerald-800'
              : toast.type === 'error'
              ? 'border-red-200 text-red-800'
              : 'border-slate-200 text-slate-800';

          const badgeClasses =
            toast.type === 'success'
              ? 'bg-emerald-100 text-emerald-700'
              : toast.type === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-slate-100 text-slate-700';

          const label =
            toast.type === 'success' ? 'Success' : toast.type === 'error' ? 'Error' : 'Notice';

          return (
            <div key={toast.id} className={`${baseClasses} ${typeClasses}`}>
              <div className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${badgeClasses}`}>
                {label}
              </div>
              <div className="flex-1 text-xs leading-snug">{toast.message}</div>
              <button
                onClick={() => handleDismiss(toast.id)}
                className="ml-2 text-slate-400 hover:text-slate-600 text-xs"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

