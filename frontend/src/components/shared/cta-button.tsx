import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

interface CTAButtonProps {
  to?: string
  href?: string
  children: React.ReactNode
  variant?: 'primary' | 'outline'
  className?: string
}

export function CTAButton({ to, href, children, variant = 'primary', className = '' }: CTAButtonProps) {
  const base = `group inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 text-sm font-semibold transition-all duration-300 active:scale-[0.98] ${
    variant === 'primary'
      ? 'bg-primary text-white shadow-glow hover:bg-primary-dark hover:shadow-[0_0_0_1px_rgb(37_99_235/0.2),0_12px_40px_-8px_rgb(37_99_235/0.5)]'
      : 'border border-border bg-white/70 text-foreground backdrop-blur hover:border-primary/40 hover:text-primary dark:bg-slate-900/50'
  } ${className}`

  const inner = (
    <>
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </>
  )

  if (href) {
    return (
      <a href={href} className={base}>
        {inner}
      </a>
    )
  }
  return (
    <Link to={to ?? '/'} className={base}>
      {inner}
    </Link>
  )
}
