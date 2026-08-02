import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Search,
  Users,
  UserPlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Video,
  Pencil,
  UserRound,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Switch, Badge } from '@/components/ui'
import { Avatar, AvatarFallback, AvatarImage, EmptyState, PageHeader, RecommendationBadge, StatusBadge } from '@/components/shared'
import { useAdminCandidates, useAdminInterviews, queryKeys, prefetchAdminAnalysis } from '@/hooks'
import { adminApi, mediaUrl, getErrorMessage } from '@/services/api'
import { formatDuration, initials } from '@/lib/utils'
import type { AdminCandidate, AdminInterview, CandidateUpdatePayload, InterviewStatusValue, RecommendationVerdict } from '@/types'

type SortKey = 'candidate_name' | 'job_title' | 'overall_score' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 8

export function AdminCandidates() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: interviews, isLoading, isError } = useAdminInterviews()
  const { data: candidates, isLoading: candidatesLoading, isError: candidatesError } = useAdminCandidates()

  const [view, setView] = useState<'candidates' | 'interviews'>('candidates')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [recommendationFilter, setRecommendationFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [candidatePage, setCandidatePage] = useState(1)

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
      queryClient.invalidateQueries({ queryKey: queryKeys.adminCandidates })
      queryClient.invalidateQueries({ queryKey: ['admin', 'registered-candidates'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  // Add-candidate dialog state.
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    gender: '',
  })
  const createCandidateMutation = useMutation({
    mutationFn: (payload: typeof addForm) => adminApi.createCandidate(payload),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Candidate created')
      setAddOpen(false)
      setAddForm({ first_name: '', last_name: '', email: '', password: '', phone: '', gender: '' })
      queryClient.invalidateQueries({ queryKey: ['admin', 'registered-candidates'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const canSubmitAdd =
    addForm.first_name.trim() &&
    addForm.last_name.trim() &&
    addForm.email.trim().includes('@') &&
    addForm.password.length >= 8

  const [pendingDelete, setPendingDelete] = useState<AdminInterview | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminCandidate | null>(null)

  // Edit-candidate dialog state.
  const [editing, setEditing] = useState<AdminCandidate | null>(null)
  const [editForm, setEditForm] = useState<CandidateUpdatePayload>({})
  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CandidateUpdatePayload }) =>
      adminApi.updateCandidate(id, payload),
    onSuccess: () => {
      toast.success('Candidate updated')
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.adminCandidates })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminInterviews })
      queryClient.invalidateQueries({ queryKey: ['admin', 'registered-candidates'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const openEdit = (candidate: AdminCandidate) => {
    setEditing(candidate)
    setEditForm({
      first_name: candidate.full_name.split(' ')[0],
      last_name: candidate.full_name.split(' ').slice(1).join(' ') || '',
      phone: candidate.phone ?? '',
      gender: candidate.gender ?? '',
      is_active: candidate.is_active,
    })
  }

  const filteredCandidates = useMemo(() => {
    if (!candidates) return []
    const q = deferredSearch.trim().toLowerCase()
    return candidates.filter((c) => {
      if (!q) return true
      return [c.full_name, c.email, c.latest_interview?.job_title ?? ''].join(' ').toLowerCase().includes(q)
    })
  }, [candidates, deferredSearch])

  const candidateTotalPages = Math.max(1, Math.ceil(filteredCandidates.length / PAGE_SIZE))
  const candidatePageItems = filteredCandidates.slice((candidatePage - 1) * PAGE_SIZE, candidatePage * PAGE_SIZE)

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

  if ((view === 'interviews' && isLoading) || (view === 'candidates' && candidatesLoading)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidates" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if ((view === 'interviews' && isError) || (view === 'candidates' && candidatesError)) {
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
        description="Every registered candidate, with their interview status."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
              <Button
                size="sm"
                variant={view === 'candidates' ? 'default' : 'ghost'}
                onClick={() => setView('candidates')}
              >
                <UserRound />
                All Candidates
              </Button>
              <Button
                size="sm"
                variant={view === 'interviews' ? 'default' : 'ghost'}
                onClick={() => setView('interviews')}
              >
                <Video />
                Interviews
              </Button>
            </div>
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <UserPlus />
              Add Candidate
            </Button>
            <Button asChild>
              <Link to="/admin/upload">
                <Video />
                Upload interview
              </Link>
            </Button>
          </div>
        }
      />

      {view === 'candidates' && (
        <>
          {/* Candidates search */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCandidatePage(1)
                }}
                placeholder="Search by name, email or job title…"
                className="pl-9"
              />
            </div>
          </div>

          {/* Candidates table */}
          <Card>
            <CardContent className="p-0">
              {candidatePageItems.length === 0 ? (
                <div className="p-10">
                  <EmptyState
                    icon={Users}
                    title="No candidates found"
                    description={candidates?.length ? 'Try adjusting your search.' : 'Add a candidate or upload an interview to get started.'}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3.5">Candidate</th>
                        <th className="hidden px-5 py-3.5 md:table-cell">Contact</th>
                        <th className="px-5 py-3.5">Interview</th>
                        <th className="hidden px-5 py-3.5 lg:table-cell">Latest Interview</th>
                        <th className="hidden px-5 py-3.5 sm:table-cell">Date joined</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {candidatePageItems.map((candidate) => (
                        <motion.tr
                          key={candidate.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="cursor-pointer transition-colors hover:bg-accent/40"
                          onClick={() => {
                            if (candidate.latest_interview) {
                              navigate(`/admin/candidates/${candidate.latest_interview.id}`)
                            } else {
                              navigate(`/admin/upload?candidate=${encodeURIComponent(candidate.email)}`)
                              toast(`Select a file to start ${candidate.full_name}'s first interview.`)
                            }
                          }}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={mediaUrl(candidate.profile_picture_url)} alt={candidate.full_name} />
                                <AvatarFallback>{initials(candidate.full_name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-foreground">{candidate.full_name}</p>
                                <p className="text-xs text-muted-foreground">{candidate.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-5 py-4 text-xs text-muted-foreground md:table-cell">
                            {candidate.phone || '—'}
                            {candidate.gender && <span className="mt-0.5 block">{candidate.gender}</span>}
                          </td>
                          <td className="px-5 py-4">
                            {candidate.has_interview ? (
                              <Badge variant="success">Interviewed</Badge>
                            ) : (
                              <Badge variant="secondary">Not interviewed</Badge>
                            )}
                          </td>
                          <td className="hidden px-5 py-4 lg:table-cell">
                            {candidate.latest_interview ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge status={candidate.latest_interview.status} />
                                <RecommendationBadge verdict={candidate.latest_interview.recommendation} />
                                <span className="text-xs text-muted-foreground">
                                  {candidate.latest_interview.job_title || '—'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="hidden px-5 py-4 text-xs text-muted-foreground sm:table-cell">
                            {candidate.created_at
                              ? new Date(candidate.created_at).toLocaleDateString(undefined, {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={`Edit ${candidate.full_name}`}
                                onClick={() => openEdit(candidate)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                aria-label={`Delete ${candidate.full_name}`}
                                onClick={() => setDeleteTarget(candidate)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {candidateTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border/60 px-5 py-3.5">
                  <p className="text-xs text-muted-foreground">
                    Page {candidatePage} of {candidateTotalPages} · {filteredCandidates.length} results
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={candidatePage <= 1} onClick={() => setCandidatePage((p) => p - 1)}>
                      <ChevronLeft />
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={candidatePage >= candidateTotalPages} onClick={() => setCandidatePage((p) => p + 1)}>
                      Next
                      <ChevronRight />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {view === 'interviews' && (
        <>
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
                    title="No interviews found"
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
                        ) : interview.has_speech === false ? (
                          <span className="text-xs font-semibold text-muted-foreground">No speech</span>
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
        </>
      )}

      {/* Delete candidate (from All Candidates view) */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete candidate</DialogTitle>
            <DialogDescription>
              This permanently deletes{' '}
              <span className="font-semibold text-foreground">{deleteTarget?.full_name}</span> and all of
              their interviews. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteCandidateMutation.isPending}
              onClick={() => {
                if (!deleteTarget) return
                deleteCandidateMutation.mutate(deleteTarget.id, {
                  onSettled: () => setDeleteTarget(null),
                })
              }}
            >
              <Trash2 />
              Delete candidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit candidate */}
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit candidate</DialogTitle>
            <DialogDescription>
              Update {editing?.full_name}'s basic details.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!editing || editMutation.isPending) return
              editMutation.mutate({ id: editing.id, payload: editForm })
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit_first_name">First name</Label>
                <Input
                  id="edit_first_name"
                  value={editForm.first_name ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_last_name">Last name</Label>
                <Input
                  id="edit_last_name"
                  value={editForm.last_name ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit_phone">Phone</Label>
                <Input
                  id="edit_phone"
                  value={editForm.phone ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_gender">Gender</Label>
                <Select
                  value={editForm.gender ?? ''}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, gender: v }))}
                >
                  <SelectTrigger id="edit_gender" className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
              <div>
                <Label htmlFor="edit_active" className="font-semibold">Active account</Label>
                <p className="text-xs text-muted-foreground">Disabled candidates can't log in and are hidden from the list.</p>
              </div>
              <Switch
                id="edit_active"
                checked={editForm.is_active ?? false}
                onCheckedChange={(checked) => setEditForm((f) => ({ ...f, is_active: checked }))}
              />
            </div>
            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={editMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editMutation.isPending}>
                <Pencil />
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

      {/* Add Candidate — full register-style form */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) setAddOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
            <DialogDescription>
              Create a candidate account. The candidate can log in with these credentials.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!canSubmitAdd || createCandidateMutation.isPending) return
              createCandidateMutation.mutate(addForm)
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add_first_name">First name <span className="text-destructive">*</span></Label>
                <Input
                  id="add_first_name"
                  value={addForm.first_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, first_name: e.target.value }))}
                  placeholder="e.g. Ali"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add_last_name">Last name <span className="text-destructive">*</span></Label>
                <Input
                  id="add_last_name"
                  value={addForm.last_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, last_name: e.target.value }))}
                  placeholder="e.g. Khan"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add_email">Email <span className="text-destructive">*</span></Label>
              <Input
                id="add_email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="candidate@example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add_password">Password <span className="text-destructive">*</span></Label>
              <Input
                id="add_password"
                type="password"
                value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
                autoComplete="new-password"
              />
              {addForm.password && addForm.password.length < 8 && (
                <p className="text-xs text-destructive">Password must be at least 8 characters.</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add_phone">Phone</Label>
                <Input
                  id="add_phone"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+92 300 1234567"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add_gender">Gender</Label>
                <Select
                  value={addForm.gender}
                  onValueChange={(v) => setAddForm((f) => ({ ...f, gender: v }))}
                >
                  <SelectTrigger id="add_gender" className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={createCandidateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmitAdd} loading={createCandidateMutation.isPending}>
                <UserPlus />
                Create Candidate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
