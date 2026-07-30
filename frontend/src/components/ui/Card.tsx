import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = true }: CardProps) {
  return (
    <div
      className={`bg-white dark:bg-[#1E293B] rounded-xl shadow-md p-6 border border-transparent ${
        hover
          ? 'transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
