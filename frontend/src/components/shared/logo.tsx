import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { ScanEye } from 'lucide-react'

interface LogoProps {
  className?: string
  to?: string
  showText?: boolean
}

export function Logo({ className, to = '/', showText = true }: LogoProps) {
  const content = (
    <>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-glow">
        <ScanEye className="h-5 w-5 text-white" strokeWidth={2.2} />
      </span>
      {showText && (
        <span className="font-display text-xl font-bold tracking-tight text-foreground">
          HireLens <span className="text-primary">AI</span>
        </span>
      )}
    </>
  )

  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5 transition-opacity hover:opacity-90', className)}>
      {content}
    </Link>
  )
}
