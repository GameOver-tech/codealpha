import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ScanEye,
  ChevronRight,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, Button, Badge } from '@/components/ui'
import { ThemeToggle, RecommendationBadge, StatusBadge } from '@/components/shared'
import { ChatSidebar } from '@/components/chat'
import { useAuth } from '@/context'
import { useProfile, useInterviewStatus } from '@/hooks'
import { mediaUrl } from '@/services/api'
import { initials } from '@/lib/utils'
import type { RecommendationVerdict } from '@/types'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/results', label: 'Results', icon: FileText },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function CandidateLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: profile } = useProfile()
  const { data: status, isLoading: statusLoading } = useInterviewStatus()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleOpenProfile = () => {
    setMobileOpen(false)
    navigate('/dashboard/profile')
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-border/60 px-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-glow">
          <ScanEye className="h-5 w-5 text-white" />
        </span>
        <span className="font-display text-lg font-bold text-foreground">
          HireLens <span className="text-primary">AI</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-5" aria-label="Candidate navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 overflow-hidden rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="candidate-nav-active"
                    className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon className={`h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110`} />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className={`h-3.5 w-3.5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-60 ${isActive ? 'translate-x-0 opacity-60' : '-translate-x-1'}`} />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Profile card — the ONLY way to open the profile page. */}
      <div className="border-t border-border/60 p-4">
        <motion.button
          type="button"
          onClick={handleOpenProfile}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative w-full overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/8 via-card to-card p-3 text-left shadow-sm backdrop-blur-xl transition-colors duration-300 hover:border-primary/40 hover:shadow-card"
          aria-label="Open profile"
        >
          {/* Animated border glow on hover */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="flex items-center gap-3">
            <span className="relative shrink-0">
              <Avatar className="h-11 w-11 border-2 border-card shadow-sm transition-transform duration-300 group-hover:scale-105">
                <AvatarImage src={mediaUrl(profile?.profile_picture_url)} alt={user?.full_name ?? ''} />
                <AvatarFallback>{initials(user?.full_name ?? 'U')}</AvatarFallback>
              </Avatar>
              {/* Online indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{user?.full_name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
              {/* Current interview status + recommendation */}
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
          </span>
        </motion.button>

        <Button variant="ghost" className="mt-2 w-full justify-start text-muted-foreground" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
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
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-display text-sm font-semibold text-muted-foreground lg:hidden">Candidate</span>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <ChatSidebar role="candidate" />
    </div>
  )
}
