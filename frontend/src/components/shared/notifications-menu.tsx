import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCircle2, Loader2, XCircle, Video, Inbox } from 'lucide-react'
import { Button } from '@/components/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'
import { useAdminInterviews } from '@/hooks'
import { cn } from '@/lib/utils'

/**
 * Notification center fed by real backend data (admin interview list).
 * Shows recent activity: new uploads, completed/failed processing.
 */
export function NotificationsMenu() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  // Fetch the interview list lazily — only when the dropdown is opened.
  // Previously this ran on mount and polled every 15s on EVERY admin page,
  // which duplicated the dashboard's traffic and slowed every page load.
  const { data: interviews = [], isFetching } = useAdminInterviews(open)

  // Build a real activity feed from the backend's interview list.
  const recent = [...interviews]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 6)

  const activeCount = interviews.filter((i) => !['completed', 'failed'].includes(i.status)).length
  const hasUnread = activeCount > 0

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-[1.15rem] w-[1.15rem]" />
          {hasUnread && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <p className="text-sm font-bold text-foreground">Notifications</p>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {activeCount} active
            </span>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isFetching && interviews.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Loading activity…</p>
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            </div>
          ) : (
            recent.map((interview) => {
              const status = interview.status
              const failed = status === 'failed'
              const done = status === 'completed'
              return (
                <button
                  key={interview.id}
                  onClick={() => {
                    setOpen(false)
                    navigate(`/admin/candidates/${interview.id}`)
                  }}
                  className="flex w-full cursor-pointer items-start gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent/50"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      failed ? 'bg-destructive/10 text-destructive' : done ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary',
                    )}
                  >
                    {failed ? <XCircle className="h-4 w-4" /> : done ? <CheckCircle2 className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">
                      {interview.candidate_name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {failed
                        ? 'Processing failed'
                        : done
                          ? 'Evaluation completed'
                          : `Processing (${Math.round(interview.progress ?? 0)}%)`}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground/60">
                      {interview.created_at
                        ? new Date(interview.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : '—'}
                    </span>
                  </span>
                  <Video className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                </button>
              )
            })
          )}
        </div>

        <DropdownMenuSeparator />
        <div className="p-1.5">
          <button
            onClick={() => {
              setOpen(false)
              navigate('/admin/processing')
            }}
            className="w-full cursor-pointer rounded-lg px-3 py-2 text-center text-[13px] font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            View all activity
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
