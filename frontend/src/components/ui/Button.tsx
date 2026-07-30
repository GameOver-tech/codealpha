import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  children: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  children,
  fullWidth,
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'rounded-xl px-6 py-3 font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] active:shadow-sm';

  const variants = {
    primary:
      'bg-[#4F6EF7] text-white hover:bg-[#3D5BD9] hover:brightness-110 shadow-sm',
    secondary:
      'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
    outline:
      'border-2 border-[#4F6EF7] text-[#4F6EF7] hover:bg-blue-50 dark:hover:bg-blue-900/20',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
