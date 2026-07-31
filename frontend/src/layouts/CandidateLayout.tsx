import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard,
  FileText,
  Settings,
  Menu,
  X,
  ScanEye,
  ClipboardList,
  Bell,
  Search,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, Button, Badge } from '@/components/ui'
import { ThemeToggle, RecommendationBadge, StatusBadge, AccountMenu } from '@/components/shared'
import { ChatSidebar } from '@/components/chat'
import { useAuth } from '@/context'
import { useProfile, useInterviewStatus } from '@/hooks'
import { mediaUrl } from '@/services/api'
import { initials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { RecommendationVerdict } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'My Space',
    items: [
      { to: '/dashboard/status', label: 'Interview Status', icon: ClipboardList },
      { to: '/dashboard/results', label: 'Results', icon: FileText },
      { to: '/dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function CandidateLayout() {
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: profile } = useProfile()
  const { data: status, isLoading: statusLoading } = useInterviewStatus()

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
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Candidate navigation">
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
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* Interview status card */}
        <div className="pt-2">
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">Interview</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {statusLoading && !status ? (
                <span className="h-5 w-20 animate-pulse rounded-full bg-muted" />
              ) : status ? (
                <StatusBadge status={status.status} />
              ) : (
                <Badge variant="secondary">No interview</Badge>
              )}
              {status?.recommendation && (
                <RecommendationBadge verdict={status.recommendation as RecommendationVerdict} />
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Account */}
      <div className="border-t border-border/60 p-3">
        <AccountMenu basePath="/dashboard">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-accent"
            aria-label="Open account menu"
          >
            <span className="relative shrink-0">
              <Avatar className="h-9 w-9 border-2 border-card">
                <AvatarImage src={mediaUrl(profile?.profile_picture_url)} alt={user?.full_name ?? ''} />
                <AvatarFallback>{initials(user?.full_name ?? 'U')}</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
            </span>
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
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="search"
                placeholder="Search…"
                className="h-9 w-64 rounded-lg border border-border/60 bg-muted/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <span className="font-display text-sm font-semibold text-muted-foreground lg:hidden">Candidate</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
              <Bell className="h-[1.15rem] w-[1.15rem]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            </Button>
            <ThemeToggle />
            <div className="ml-1 border-l border-border/60 pl-2">
              <AccountMenu basePath="/dashboard">
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-2 rounded-full p-0.5 transition-shadow hover:ring-2 hover:ring-primary/30"
                  aria-label="Open account menu"
                >
                  <Avatar className="h-8 w-8 border-2 border-card">
                    <AvatarImage src={mediaUrl(profile?.profile_picture_url)} alt={user?.full_name ?? ''} />
                    <AvatarFallback>{initials(user?.full_name ?? 'U')}</AvatarFallback>
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

      <ChatSidebar role="candidate" />
    </div>
  )
}
