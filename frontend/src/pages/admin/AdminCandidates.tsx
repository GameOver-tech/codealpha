import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Search,
  Users,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Video,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui'
import { Avatar, AvatarFallback, AvatarImage, EmptyState, PageHeader, RecommendationBadge, StatusBadge } from '@/components/shared'
import { useAdminInterviews, queryKeys, prefetchAdminAnalysis } from '@/hooks'
import { adminApi, mediaUrl, getErrorMessage } from '@/services/api'
import { formatDuration, initials } from '@/lib/utils'
import type { AdminInterview, InterviewStatusValue, RecommendationVerdict } from '@/types'

type SortKey = 'candidate_name' | 'job_title' | 'overall_score' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 8

export function AdminCandidates() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: interviews, isLoading, isError } = useAdminInterviews()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [recommendationFilter, setRecommendationFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  // Keep the search input responsive — filtering runs on the deferred value
  // so typing never blocks the table render.
  const deferredSearch = useDeferredValue(search)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteInterview(id),
    onSuccess: () => {
      toast.success('Interview deleted')
      queryClient.invalidateQueries({ queryKey: queryKeys.adminInterviews })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteCandidateMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteCandidate(id),
    onSuccess: () => {
      toast.success('Candidate and all interviews deleted')
      queryClient.invalidateQueries({ queryKey: queryKeys.adminInterviews })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const [pendingDelete, setPendingDelete] = useState<AdminInterview | null>(null)

  const filtered = useMemo(() => {
    if (!interviews) return []
    const q = deferredSearch.trim().toLowerCase()
    return interviews
      .filter((i) => {
        if (q) {
          const haystack = [
            i.candidate_name,
            i.candidate_email,
            i.job_title,
            i.recommendation ?? '',
            i.status.replace(/_/g, ' '),
          ]
            .join(' ')
            .toLowerCase()
          if (!haystack.includes(q)) return false
        }
        if (statusFilter !== 'all' && i.status !== (statusFilter as InterviewStatusValue)) return false
        if (recommendationFilter !== 'all' && i.recommendation !== (recommendationFilter as RecommendationVerdict)) return false
        return true
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1
        if (sortKey === 'overall_score') {
          return ((a.overall_score ?? -1) - (b.overall_score ?? -1)) * dir
        }
        if (sortKey === 'created_at') {
          return (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()) * dir
        }
        const av = String(a[sortKey] ?? '').toLowerCase()
        const bv = String(b[sortKey] ?? '').toLowerCase()
        return av.localeCompare(bv) * dir
      })
  }, [interviews, deferredSearch, statusFilter, recommendationFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidates" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        icon={Video}
        title="Could not load candidates"
        description="The backend may be unavailable. Check that the API server is running."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        description="All interview evaluations in one place."
        actions={
          <Button asChild>
            <Link to="/admin/upload">
              <Video />
              Upload interview
            </Link>
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search by name, email or job title…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="uploaded">Uploaded</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={recommendationFilter} onValueChange={(v) => { setRecommendationFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Recommendation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All recommendations</SelectItem>
            <SelectItem value="Recommended">Recommended</SelectItem>
            <SelectItem value="Not Recommended">Not Recommended</SelectItem>
            <SelectItem value="Need Further Review">Need Further Review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {pageItems.length === 0 ? (
            <div className="p-10">
              <EmptyState
                icon={Users}
                title="No candidates found"
                description="Try adjusting your search or filters."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3.5">
                      <button onClick={() => toggleSort('candidate_name')} className="inline-flex items-center gap-1.5 hover:text-foreground">
                        Candidate <SortIcon column="candidate_name" />
                      </button>
                    </th>
                    <th className="hidden px-5 py-3.5 md:table-cell">
                      <button onClick={() => toggleSort('job_title')} className="inline-flex items-center gap-1.5 hover:text-foreground">
                        Job <SortIcon column="job_title" />
                      </button>
                    </th>
                    <th className="hidden px-5 py-3.5 sm:table-cell">
                      <button onClick={() => toggleSort('overall_score')} className="inline-flex items-center gap-1.5 hover:text-foreground">
                        Score <SortIcon column="overall_score" />
                      </button>
                    </th>
                    <th className="px-5 py-3.5">
                      <button onClick={() => toggleSort('status')} className="inline-flex items-center gap-1.5 hover:text-foreground">
                        Status <SortIcon column="status" />
                      </button>
                    </th>
                    <th className="hidden px-5 py-3.5 lg:table-cell">Recommendation</th>
                    <th className="hidden px-5 py-3.5 lg:table-cell">
                      <button onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1.5 hover:text-foreground">
                        Date <SortIcon column="created_at" />
                      </button>
                    </th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {pageItems.map((interview) => (
                    <motion.tr
                      key={interview.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="cursor-pointer transition-colors hover:bg-accent/40"
                      onClick={() => navigate(`/admin/candidates/${interview.id}`)}
                      onMouseEnter={() => void prefetchAdminAnalysis(queryClient, interview.id)}
                      onFocus={() => void prefetchAdminAnalysis(queryClient, interview.id)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage
                              src={mediaUrl(interview.candidate_profile?.profile_picture_url)}
                              alt={interview.candidate_name}
                            />
                            <AvatarFallback>{initials(interview.candidate_name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground">{interview.candidate_name}</p>
                            <p className="text-xs text-muted-foreground">{interview.candidate_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-5 py-4 text-muted-foreground md:table-cell">{interview.job_title}</td>
                      <td className="hidden px-5 py-4 sm:table-cell">
                        {interview.overall_score !== null ? (
                          <span className="font-display text-base font-bold text-foreground">
                            {Math.round(interview.overall_score)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={interview.status} />
                      </td>
                      <td className="hidden px-5 py-4 lg:table-cell">
                        <RecommendationBadge verdict={interview.recommendation} />
                      </td>
                      <td className="hidden px-5 py-4 text-xs text-muted-foreground lg:table-cell">
                        {interview.created_at
                          ? new Date(interview.created_at).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                        {interview.duration_seconds > 0 && (
                          <span className="mt-0.5 block">{formatDuration(interview.duration_seconds)}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${interview.candidate_name}`}
                          onClick={() => setPendingDelete(interview)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 px-5 py-3.5">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {filtered.length} results
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft />
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete options: interview only, or the whole candidate */}
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete options</DialogTitle>
            <DialogDescription>
              Choose what to delete for{' '}
              <span className="font-semibold text-foreground">{pendingDelete?.candidate_name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button
              variant="destructive"
              className="justify-start"
              disabled={deleteMutation.isPending || deleteCandidateMutation.isPending}
              loading={deleteMutation.isPending}
              onClick={() => {
                if (!pendingDelete) return
                deleteMutation.mutate(pendingDelete.id, {
                  onSettled: () => setPendingDelete(null),
                })
              }}
            >
              <Trash2 />
              Delete Interview Only
            </Button>
            <Button
              variant="destructive"
              className="justify-start"
              disabled={deleteMutation.isPending || deleteCandidateMutation.isPending}
              loading={deleteCandidateMutation.isPending}
              onClick={() => {
                if (!pendingDelete) return
                deleteCandidateMutation.mutate(pendingDelete.candidate_id, {
                  onSettled: () => setPendingDelete(null),
                })
              }}
            >
              <Trash2 />
              Delete Candidate (all interviews)
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
