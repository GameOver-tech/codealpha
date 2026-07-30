import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (t: { title: string; description?: string; type?: ToastType }) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback(({ title, description, type = 'info' }: { title: string; description?: string; type?: ToastType }) => {
    const id = String(++toastId);
    setToasts(prev => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const iconMap = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
  };

  const borderMap = {
    success: 'border-l-4 border-[#22C55E]',
    error: 'border-l-4 border-[#EF4444]',
    info: 'border-l-4 border-[#4F6EF7]',
  };

  const iconColorMap = {
    success: 'text-[#22C55E]',
    error: 'text-[#EF4444]',
    info: 'text-[#4F6EF7]',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => {
            const Icon = iconMap[t.type];
            return (
              <div
                key={t.id}
                className={`pointer-events-auto bg-[var(--color-card)] rounded-xl shadow-lg ${borderMap[t.type]} p-4 flex items-start gap-3 animate-slide-in border border-[var(--color-border)]`}
                style={{
                  animation: 'slideIn 0.3s ease-out',
                }}
              >
                <Icon size={20} className={`shrink-0 mt-0.5 ${iconColorMap[t.type]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-heading)]">{t.title}</p>
                  {t.description && <p className="text-xs text-[var(--color-body)] mt-0.5">{t.description}</p>}
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="text-[var(--color-muted)] hover:text-[var(--color-heading)] transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
