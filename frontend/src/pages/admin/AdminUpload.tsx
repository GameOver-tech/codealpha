import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud, FileVideo, X, AlertTriangle, CheckCircle2, Mail, Search, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Input, Label, Textarea, Progress } from '@/components/ui'
import { PageHeader } from '@/components/shared'
import { adminApi, getErrorMessage } from '@/services/api'
import { formatBytes, cn } from '@/lib/utils'
import type { RegisteredCandidate } from '@/types'

const ACCEPTED_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'm4a', 'flac', 'aac']
const MAX_SIZE = 200 * 1024 * 1024 // 200 MB

export function AdminUpload() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<RegisteredCandidate | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load every active registered candidate once (staleTime keeps it cached).
  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['admin', 'registered-candidates'],
    queryFn: async () => (await adminApi.registeredCandidates()).data,
    staleTime: 5 * 60 * 1000,
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    )
  }, [candidates, query])

  // Reset the highlighted row whenever the filtered list changes.
  useEffect(() => setHighlighted(0), [filtered.length, open])

  // Close the dropdown on outside click. The container wraps BOTH the input
  // and the dropdown list, so clicking an option never counts as "outside" —
  // otherwise the mousedown listener would close the list before the option's
  // click event fires, silently breaking selection.
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  // Keep the highlighted option in view while navigating with the keyboard.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  const pick = useCallback((candidate: RegisteredCandidate) => {
    setSelected(candidate)
    setQuery('')
    setOpen(false)
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setHighlighted((h) =>
        e.key === 'ArrowDown'
          ? Math.min(h + 1, Math.max(filtered.length - 1, 0))
          : Math.max(h - 1, 0),
      )
    } else if (e.key === 'Enter') {
      if (!open) {
        e.preventDefault()
        setOpen(true)
        return
      }
      e.preventDefault()
      const option = filtered[highlighted]
      if (option) pick(option)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const validateFile = useCallback((candidate: File): string | null => {
    const ext = candidate.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type ".${ext}". Allowed: ${ACCEPTED_EXTENSIONS.join(', ')}.`
    }
    if (candidate.size > MAX_SIZE) {
      return `File is too large (max 200MB). Your file is ${formatBytes(candidate.size)}.`
    }
    return null
  }, [])

  const onDrop = useCallback(
    (accepted: File[]) => {
      const candidate = accepted[0]
      if (!candidate) return
      const err = validateFile(candidate)
      if (err) {
        setError(err)
        toast.error(err)
        return
      }
      setError(null)
      setFile(candidate)
    },
    [validateFile],
  )

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac', '.aac'],
    },
    maxFiles: 1,
    multiple: false,
    noClick: true,
  })

  const handleUpload = async () => {
    if (!file || !selected) return
    setUploading(true)
    setProgress(15)
    const timer = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 95) {
          window.clearInterval(timer)
          return p
        }
        return p + Math.random() * 8
      })
    }, 400)
    try {
      // The upload flow is unchanged — the selected candidate's email is
      // passed straight to the existing endpoint.
      const res = await adminApi.upload(file, selected.email, jobTitle || 'Interview', jobDescription)
      window.clearInterval(timer)
      setProgress(100)
      toast.success(`Upload successful! Processing started for ${res.candidate_email}.`)
      navigate(`/admin/processing/${res.interview_id}`)
    } catch (uploadError) {
      window.clearInterval(timer)
      setProgress(0)
      toast.error(getErrorMessage(uploadError))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Upload Interview"
        description="Submit a recording — processing starts automatically."
      />

      <Card>
        <CardContent className="p-6 sm:p-8">
          <div
            {...getRootProps()}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all duration-300 ${
              isDragActive
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-primary/50 hover:bg-muted/40'
            }`}
          >
            <input {...getInputProps()} />
            <motion.div
              animate={{ y: isDragActive ? -6 : 0 }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-blue-400/15 text-primary"
            >
              <UploadCloud className="h-8 w-8" />
            </motion.div>
            <h3 className="mt-5 font-display text-lg font-bold text-foreground">
              {isDragActive ? 'Drop your recording here' : 'Drag & drop your recording here'}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              MP4, MOV, AVI, MKV, MP3, WAV, M4A, FLAC, AAC · up to 200MB
            </p>
            <Button variant="outline" className="mt-6" onClick={openFilePicker} disabled={uploading}>
              Choose file
            </Button>
          </div>

          {/* Selected file */}
          {file && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex items-center gap-4 rounded-xl border border-border/60 bg-muted/40 p-4"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileVideo className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              {error ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Invalid
                </span>
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              )}
              {!uploading && (
                <Button variant="ghost" size="icon" onClick={() => { setFile(null); setError(null) }} aria-label="Remove file">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </motion.div>
          )}

          {/* Upload progress */}
          {uploading && (
            <div className="mt-5">
              <Progress value={progress} className="h-2" indicatorClassName="bg-gradient-to-r from-primary to-blue-400" />
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Uploading… {Math.round(progress)}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="space-y-2">
            <Label htmlFor="candidate_search">
              Candidate <span className="text-destructive">*</span>
            </Label>
            {/* Container wraps BOTH the input and the dropdown so clicking an
                option never registers as an outside click. */}
            <div ref={containerRef} className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="candidate_search"
                ref={inputRef}
                type="text"
                value={selected ? `${selected.full_name} (${selected.email})` : query}
                onChange={(e) => {
                  if (selected) setSelected(null)
                  setQuery(e.target.value)
                  setOpen(true)
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                placeholder="Search candidate by name or email…"
                className="pl-9 pr-9"
                autoComplete="off"
                disabled={uploading}
              />
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              {/* Searchable candidate dropdown */}
              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover shadow-card"
                  >
                    <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5">
                      {loadingCandidates ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                          Loading candidates…
                        </p>
                      ) : filtered.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                          No candidates match “{query}”.
                        </p>
                      ) : (
                        filtered.map((candidate, index) => {
                          const active = index === highlighted
                          return (
                            <button
                              key={candidate.id}
                              type="button"
                              data-index={index}
                              onMouseEnter={() => setHighlighted(index)}
                              onClick={() => pick(candidate)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                                active ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                              )}
                            >
                              <span
                                className={cn(
                                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                                  active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                                )}
                              >
                                <Users className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-foreground">
                                  {candidate.full_name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {candidate.email}
                                </span>
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {selected && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {selected.full_name} · {selected.email}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Only active registered candidates are listed. The interview will be linked to the
              selected candidate's account.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="job_title">Job title</Label>
            <Input
              id="job_title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job_description">Job description</Label>
            <Textarea
              id="job_description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description so the AI can evaluate responses against it…"
              rows={5}
            />
          </div>
          <Button
            size="lg"
            className="w-full"
            onClick={handleUpload}
            disabled={!file || Boolean(error) || !selected}
            loading={uploading}
          >
            <UploadCloud />
            Submit interview
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
