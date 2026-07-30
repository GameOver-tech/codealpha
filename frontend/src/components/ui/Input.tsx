import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium" style={{ color: 'var(--color-heading)' }}>{label}</label>}
      <input
        className={`rounded-lg border px-4 py-3 transition-all text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6EF7] focus:border-transparent ${
          error ? 'border-[#EF4444]' : 'border-gray-200 dark:border-gray-600'
        } ${className}`}
        style={{ color: 'var(--color-heading)', backgroundColor: 'var(--color-card)' }}
        {...props}
      />
      {error && <span className="text-xs text-[#EF4444]">{error}</span>}
    </div>
  );
}
