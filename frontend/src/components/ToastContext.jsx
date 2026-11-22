import React, { useState, useCallback } from 'react';
import { CheckCircle2, Info, Heart, X } from 'lucide-react';
import { ToastContext } from '../utils/toast';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
      setTimeout(() => removeToast(id), 3200);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="fixed bottom-6 right-4 sm:right-6 z-[100] flex flex-col gap-2.5 pointer-events-none max-w-sm w-[calc(100vw-2rem)] sm:w-auto">
        {toasts.map((toast) => {
          const Icon =
            toast.type === 'heart'
              ? Heart
              : toast.type === 'info'
                ? Info
                : CheckCircle2;

          const iconColor =
            toast.type === 'heart'
              ? 'text-white'
              : toast.type === 'info'
                ? 'text-white/75'
                : 'text-emerald-400';

          return (
            <div
              key={toast.id}
              className="pointer-events-auto animate-toast flex items-center gap-3 bg-[#111115]/95 backdrop-blur-2xl text-white px-4 py-3.5 rounded-xl border border-white/[0.12] shadow-[0_16px_40px_rgba(0,0,0,0.75)]"
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
              <span className="text-xs sm:text-sm font-medium text-white/90 flex-1">
                {toast.message}
              </span>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-white/40 hover:text-white transition-colors p-0.5"
                aria-label="Fechar notificação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
