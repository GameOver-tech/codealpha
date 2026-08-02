import { Link } from 'react-router-dom'
import { Github, ArrowRight } from 'lucide-react'
import { Logo } from './logo'

const RESOURCE_LINKS = [
  { label: 'Sign In', href: '/login' },
  { label: 'Create Account', href: '/register' },
]

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="lg:col-span-1">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              AI-powered talent evaluation for modern hiring teams. Upload interviews, get
              data-driven insights, and hire with confidence.
            </p>
            <a
              href="https://github.com/GameOver-tech/codealpha.git"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View the HireLens AI source code on GitHub"
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Github className="h-4 w-4" />
              View on GitHub
            </a>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Resources</h3>
            <ul className="mt-4 space-y-2.5">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="group flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 items-center gap-2 border-t border-border/60 pt-6 text-center sm:grid-cols-3 sm:text-left">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} HireLens AI. All rights reserved.
          </p>
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground sm:col-start-2 sm:text-center">
            Product by Code Alpha
          </p>
        </div>
      </div>
    </footer>
  )
}
