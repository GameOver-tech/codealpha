import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Upload,
  FileText,
  Settings,
  Menu,
  X,
  ScanEye,
  Loader2,
  Briefcase,
  Bot,
  Search,
  Bell,
  ChevronDown,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, Button } from '@/components/ui'
import { ThemeToggle, AccountMenu } from '@/components/shared'
import { ChatSidebar } from '@/components/chat'
import { useAuth } from '@/context'
import { initials } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof Users
  end?: boolean
  badge?: string
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Hiring',
    items: [
      { to: '/admin/jobs', label: 'Jobs', icon: Briefcase },
      { to: '/admin/candidates', label: 'Candidates', icon: Users },
      { to: '/admin/upload', label: 'Interviews', icon: Upload },
      { to: '/admin/processing', label: 'Processing', icon: Loader2 },
    ],
  },
  {
    label: 'Analytics',
    items: [{ to: '/admin/reports', label: 'Reports', icon: FileText }],
  },
  {
    label: 'Workspace',
    items: [
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function AdminLayout() {
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border/60 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-glow">
          <ScanEye className="h-5 w-5 text-white" />
        </span>
        <span className="font-display text-lg font-bold text-foreground">
          HireLens <span className="text-primary">AI</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Admin navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary/10 text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="h-[17px] w-[17px]" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* AI assistant quick toggle */}
      <div className="px-3 pb-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-dark">
            <Bot className="h-4 w-4 text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-foreground">AI Assistant</span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Gemini online
            </span>
          </span>
        </button>
      </div>

      {/* Account */}
      <div className="border-t border-border/60 p-3">
        <AccountMenu basePath="/admin">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-accent"
            aria-label="Open account menu"
          >
            <Avatar className="h-9 w-9 border-2 border-card">
              <AvatarImage src={undefined} alt={user?.full_name ?? ''} />
              <AvatarFallback>{initials(user?.full_name ?? 'A')}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-foreground">{user?.full_name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{user?.email}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground/60" />
          </button>
        </AccountMenu>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border/60 bg-card lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border/60 bg-card lg:hidden"
            >
              {sidebar}
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-5 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Top navbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
            {/* Global search */}
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="search"
                placeholder="Search candidates, interviews…"
                className="h-9 w-72 rounded-lg border border-border/60 bg-muted/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </div>
            <span className="font-display text-sm font-semibold text-muted-foreground lg:hidden">Admin</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* AI status */}
            <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              AI Online
            </span>
            {/* Notifications */}
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
              <Bell className="h-[1.15rem] w-[1.15rem]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
            </Button>
            <ThemeToggle />
            {/* Avatar (account menu) */}
            <div className="ml-1 border-l border-border/60 pl-2">
              <AccountMenu basePath="/admin">
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-2 rounded-full p-0.5 transition-shadow hover:ring-2 hover:ring-primary/30"
                  aria-label="Open account menu"
                >
                  <Avatar className="h-8 w-8 border-2 border-card">
                    <AvatarImage src={undefined} alt={user?.full_name ?? ''} />
                    <AvatarFallback>{initials(user?.full_name ?? 'A')}</AvatarFallback>
                  </Avatar>
                </button>
              </AccountMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <ChatSidebar role="admin" />
    </div>
  )
}
