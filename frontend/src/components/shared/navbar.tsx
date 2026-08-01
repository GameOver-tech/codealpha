import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X, ArrowRight } from 'lucide-react'
import { Logo } from './logo'
import { ThemeToggle } from './theme-toggle'
import { Button } from '@/components/ui'
import { useAuth } from '@/context'

const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'FAQ', href: '/#faq' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [progress, setProgress] = useState(0)
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  const handleScroll = () => {
    const current = window.scrollY > 12
    setScrolled(current)
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    setProgress(docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0)
  }
  window.addEventListener('scroll', handleScroll, { passive: true })

  const primaryAction = isAuthenticated
    ? { label: user?.role === 'admin' ? 'Admin Dashboard' : 'My Dashboard', to: user?.role === 'admin' ? '/admin' : '/dashboard' }
    : { label: 'Start Interview', to: '/upload' }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled ? 'glass-strong shadow-soft' : 'bg-transparent'
      }`}
    >
      {/* Scroll progress */}
      <div className="absolute inset-x-0 top-0 h-0.5 origin-left bg-gradient-to-r from-primary via-blue-400 to-primary" style={{ transform: `scaleX(${progress / 100})` }} />
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main">
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="nav-link rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button onClick={() => navigate(primaryAction.to)}>
              {primaryAction.label}
              <ArrowRight />
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate('/login')}>
                Sign in
              </Button>
              <Button onClick={() => navigate('/register')}>
                Get started
                <ArrowRight />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="glass-strong overflow-hidden md:hidden"
          >
            <div className="space-y-1 px-4 py-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-2">
                {isAuthenticated ? (
                  <Button onClick={() => navigate(primaryAction.to)}>
                    {primaryAction.label}
                    <ArrowRight />
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => navigate('/login')}>
                      Sign in
                    </Button>
                    <Button onClick={() => navigate('/register')}>Get started</Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
