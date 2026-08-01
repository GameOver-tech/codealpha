import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
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
  LogOut,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, Button } from '@/components/ui'
import { ThemeToggle, NotificationsMenu } from '@/components/shared'
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
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

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

      {/* Account — clicking the profile opens Settings directly. */}
      <div className="border-t border-border/60 p-3">
        <div className="flex items-center gap-1 rounded-xl p-2">
          <NavLink
            to="/admin/settings"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left transition-colors hover:bg-accent"
            aria-label="Open profile settings"
          >
            <Avatar className="h-9 w-9 border-2 border-card">
              <AvatarImage src={undefined} alt={user?.full_name ?? ''} />
              <AvatarFallback>{initials(user?.full_name ?? 'A')}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-foreground">{user?.full_name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{user?.email}</span>
            </span>
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
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
            <span className="font-display text-sm font-semibold text-muted-foreground lg:hidden">Admin</span>
          </div>

          <div className="flex items-center gap-1.5">
            <NotificationsMenu />
            <ThemeToggle />
            {/* Avatar — clicking opens Settings directly. */}
            <NavLink
              to="/admin/settings"
              className="ml-1 flex cursor-pointer items-center gap-2 rounded-full border-l border-border/60 p-0.5 pl-2 transition-shadow hover:ring-2 hover:ring-primary/30"
              aria-label="Open profile settings"
            >
              <Avatar className="h-8 w-8 border-2 border-card">
                <AvatarImage src={undefined} alt={user?.full_name ?? ''} />
                <AvatarFallback>{initials(user?.full_name ?? 'A')}</AvatarFallback>
              </Avatar>
            </NavLink>
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
