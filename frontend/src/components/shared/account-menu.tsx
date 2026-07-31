import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ChevronRight,
  HelpCircle,
  Keyboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'
import { useAuth, useTheme } from '@/context'
import { useProfile } from '@/hooks'
import { mediaUrl } from '@/services/api'
import { initials } from '@/lib/utils'

interface AccountMenuProps {
  /** Base path for account pages (admin vs candidate). */
  basePath: string
  /** The trigger element (avatar button). */
  children: React.ReactNode
}

/**
 * OpenAI/Linear-style account menu. Clicking the avatar opens a polished
 * panel with identity, account navigation (profile, settings), theme,
 * help and sign-out. Used by both admin and candidate layouts.
 */
export function AccountMenu({ basePath, children }: AccountMenuProps) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { data: profile } = useProfile()
  const navigate = useNavigate()

  const go = (path: string) => {
    navigate(path)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const roleLabel = user?.role === 'admin' ? 'Administrator' : 'Candidate'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-80 overflow-hidden p-0">
        {/* Identity header */}
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-4">
          <Avatar className="h-12 w-12 border-2 border-card shadow-sm">
            <AvatarImage src={mediaUrl(profile?.profile_picture_url)} alt={user?.full_name ?? ''} />
            <AvatarFallback>{initials(user?.full_name ?? 'U')}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{user?.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            <span className="mt-1 inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {roleLabel}
              </span>
            </span>
          </div>
        </div>

        <div className="p-1.5">
          <DropdownMenuItem onClick={() => go(`${basePath}/profile`)}>
            <UserRound className="h-4 w-4" />
            My Profile
            <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => go(`${basePath}/settings`)}>
            <Settings className="h-4 w-4" />
            Settings
            <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => go(`${basePath}/activity`)}>
            <Activity className="h-4 w-4" />
            Activity
            <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            <span className="ml-auto rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {theme === 'dark' ? '☀' : '☾'}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => go(`${basePath}/help`)}>
            <HelpCircle className="h-4 w-4" />
            Help Center
            <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => go(`${basePath}/shortcuts`)}>
            <Keyboard className="h-4 w-4" />
            Keyboard Shortcuts
            <span className="ml-auto rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              ⌘K
            </span>
          </DropdownMenuItem>
        </div>

        <div className="border-t border-border/60 p-1.5">
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
