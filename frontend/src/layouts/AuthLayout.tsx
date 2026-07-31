import { motion } from 'framer-motion'
import { ScanEye, ShieldCheck, Zap, BarChart3 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo, ThemeToggle } from '@/components/shared'

const BENEFITS = [
  { icon: Zap, text: 'AI-powered evaluation in minutes' },
  { icon: BarChart3, text: 'Deep scoring across 10 dimensions' },
  { icon: ShieldCheck, text: 'Secure, role-based access' },
]

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-slate-900 lg:block">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>

        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2.5 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <ScanEye className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-bold">HireLens AI</span>
          </div>

          <div>
            <h2 className="max-w-md font-display text-4xl font-bold leading-tight text-white">
              The smartest way to evaluate interview performance
            </h2>
            <ul className="mt-8 space-y-4">
              {BENEFITS.map((benefit) => (
                <li key={benefit.text} className="flex items-center gap-3 text-blue-100">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
                    <benefit.icon className="h-4 w-4" />
                  </span>
                  {benefit.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-blue-200/70">© {new Date().getFullYear()} HireLens AI</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="relative flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="absolute right-6 top-6 flex items-center gap-2">
          <ThemeToggle />
        </div>
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}
