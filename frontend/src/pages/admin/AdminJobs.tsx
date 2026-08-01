import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Briefcase, Plus, Search, MoreHorizontal, Clock, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Input, Label, Textarea, Badge, Skeleton } from '@/components/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui'
import { PageHeader, EmptyState } from '@/components/shared'
import { jobsApi, getErrorMessage } from '@/services/api'
import { queryKeys } from '@/hooks'
import { cn } from '@/lib/utils'
import type { Job } from '@/types'

const jobSchema = z.object({
  title: z.string().min(1, 'Job title is required').max(255),
  description: z.string().max(5000).optional(),
})

type JobForm = z.infer<typeof jobSchema>

type Tab = 'active' | 'archived'

export function AdminJobs() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('active')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: queryKeys.jobs,
    queryFn: async () => (await jobsApi.list()).data,
  })

  const form = useForm<JobForm>({ resolver: zodResolver(jobSchema) })

  const createMutation = useMutation({
    mutationFn: (values: JobForm) => jobsApi.create(values),
    onSuccess: () => {
      toast.success('Job created')
      form.reset()
      setCreateOpen(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const visible = jobs
    .filter((j) => (tab === 'active' ? j.is_active : !j.is_active))
    .filter((j) => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return j.title.toLowerCase().includes(q) || (j.description ?? '').toLowerCase().includes(q)
    })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Manage job postings for candidates."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Create job
          </Button>
        }
      />

      {/* Tabs + search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card p-1">
          {(['active', 'archived'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-sm font-medium capitalize transition-colors',
                tab === t ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                {tab === 'active'
                  ? jobs.filter((j) => j.is_active).length
                  : jobs.filter((j) => !j.is_active).length}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10 md:w-64"
          />
        </div>
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={tab === 'active' ? 'No active jobs' : 'No archived jobs'}
          description={tab === 'active' ? 'Create your first job posting to get started.' : 'Archived jobs will appear here.'}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={() => setCreateOpen(false)}>
          <Card className="w-full max-w-lg" >
            <CardContent className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">Create job</h3>
                  <p className="text-sm text-muted-foreground">Publish a new job posting for candidates.</p>
                </div>
                <button
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                  aria-label="Close"
                >
                  <MoreHorizontal className="h-5 w-5 rotate-90" />
                </button>
              </div>
              <form
                onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
                className="space-y-4"
                noValidate
              >
                <div className="space-y-2">
                  <Label htmlFor="job-title">Job title</Label>
                  <Input
                    id="job-title"
                    placeholder="e.g. Senior Frontend Engineer"
                    aria-invalid={Boolean(form.formState.errors.title)}
                    {...form.register('title')}
                  />
                  {form.formState.errors.title && (
                    <p className="text-xs font-medium text-destructive">{form.formState.errors.title.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-description">Description</Label>
                  <Textarea
                    id="job-description"
                    rows={5}
                    placeholder="Describe the role, responsibilities and ideal candidate…"
                    {...form.register('description')}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={createMutation.isPending}>
                    <Plus />
                    Create job
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function JobCard({ job }: { job: Job }) {
  const queryClient = useQueryClient()
  const created = job.created_at ? new Date(job.created_at).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  }) : '—'

  return (
    <Card className="transition-colors hover:border-border/80">
      <CardContent className="flex items-start gap-4 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Briefcase className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold text-foreground">{job.title}</h3>
            <Badge variant={job.is_active ? 'secondary' : 'outline'}>
              {job.is_active ? 'Active' : 'Archived'}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {job.description || 'No description provided.'}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Posted {created}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Applications
            </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Job actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toast.success('Job opened')}>View details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.success('Job copied')}>Copy link</DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                toast.success(job.is_active ? 'Job archived' : 'Job reactivated')
                queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
              }}
            >
              {job.is_active ? 'Archive job' : 'Reactivate'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  )
}
