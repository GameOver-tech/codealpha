import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Loader2, MessageCircle, Paperclip, Pause, Play, RotateCcw, Send, Sparkles, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { chatApi, adminApi, streamChat } from '@/services/api'
import type { ChatHistoryItem, RegisteredCandidate } from '@/types'
import { renderMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import { VoiceIndicator } from '@/components/shared'
import { useVoice } from '@/hooks/useVoice'

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachment?: { name: string; size: number }
  streaming?: boolean
}

/** Pending upload awaiting details — rendered as an in-chat form card. */
interface PendingUpload {
  file: File
}

interface ChatSidebarProps {
  role: 'admin' | 'candidate'
}

const ACCEPTED_ATTACHMENTS = 'video/*,audio/*,image/*,.mp4,.mov,.avi,.mkv,.mp3,.wav,.m4a,.flac,.aac'

// Memoized so streaming deltas only re-render the message being updated.
const MessageBubble = memo(function MessageBubble({
  message,
  speaking,
  paused,
  onSpeak,
}: {
  message: DisplayMessage
  speaking: boolean
  paused: boolean
  onSpeak: (text: string) => void
}) {
  return (
    <div key={message.id} className={cn('flex gap-2.5', message.role === 'user' && 'flex-row-reverse')}>
      {message.role === 'assistant' && (
        <span className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-dark">
          <Bot className="h-3.5 w-3.5 text-white" />
          <span className="absolute -bottom-1 -right-1 flex items-center justify-center">
            <VoiceIndicator active={speaking} paused={paused} className="bg-card text-primary" />
          </span>
        </span>
      )}
      <div
        className={cn(
          'min-w-0 max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed',
          message.role === 'user'
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md border border-border/60 bg-muted/40 text-foreground',
        )}
      >
        {message.role === 'assistant' ? (
          <div>
            <div
              className="chat-markdown [&_a]:break-all [&_table]:my-1 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
            />
            {!message.streaming && message.content && (
              <button
                type="button"
                onClick={() => onSpeak(message.content)}
                className={cn(
                  'mt-1.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-colors',
                  speaking
                    ? 'bg-primary/10 text-primary'
                    : paused
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'text-muted-foreground/60 hover:bg-accent hover:text-primary',
                )}
                aria-label={speaking ? 'Pause' : paused ? 'Resume' : 'Listen to this message'}
                title={speaking ? 'Pause' : paused ? 'Resume' : 'Listen'}
              >
                {speaking ? (
                  <Pause className="h-3 w-3" />
                ) : paused ? (
                  <Play className="ml-0.5 h-3 w-3" />
                ) : (
                  <Volume2 className="h-3 w-3" />
                )}
              </button>
            )}
          </div>
        ) : (
          <div>
            {message.attachment && (
              <span className="mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/50 bg-background/70 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate">{message.attachment.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground/60">
                  {(message.attachment.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </span>
            )}
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        )}

        {message.streaming && (
          <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> HireLens is thinking…
          </span>
        )}
      </div>
    </div>
  )
})

const ADMIN_SUGGESTIONS = [
  'Show dashboard stats',
  'List candidates',
  'Show results for a candidate',
  'Recent activity',
  'Hiring analytics',
]
const CANDIDATE_SUGGESTIONS = ['My interview status', 'What is my result?', 'I need help']

/**
 * In-chat upload details form — replaces the old native browser prompt with
 * a professional card inside the assistant panel.
 */
function UploadDetailsForm({
  fileName,
  fileSize,
  uploading,
  onSubmit,
  onCancel,
}: {
  fileName: string
  fileSize: number
  uploading: boolean
  onSubmit: (email: string, jobTitle: string) => void
  onCancel: () => void
}) {
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState<RegisteredCandidate[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Load registered candidates once so the admin can pick an email from the
  // dropdown instead of typing it from memory.
  useEffect(() => {
    let cancelled = false
    setCandidatesLoading(true)
    adminApi
      .registeredCandidates()
      .then((res) => {
        if (!cancelled) setCandidates(res.data)
      })
      .catch(() => {
        /* dropdown is optional — manual entry still works */
      })
      .finally(() => {
        if (!cancelled) setCandidatesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = email.trim()
    ? candidates.filter(
        (c) =>
          c.email.toLowerCase().includes(email.trim().toLowerCase()) ||
          c.full_name.toLowerCase().includes(email.trim().toLowerCase()),
      )
    : candidates

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!value) {
      setError('Candidate email is required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter a valid email address.')
      return
    }
    setError('')
    onSubmit(value, jobTitle.trim() || 'Interview')
  }

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[85%] rounded-2xl rounded-bl-md border border-primary/30 bg-muted/40 p-3.5">
        <div className="flex items-center gap-2">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="truncate text-xs font-semibold text-foreground">{fileName}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {(fileSize / (1024 * 1024)).toFixed(1)} MB
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-2.5 space-y-2" noValidate>
          <div className="relative">
            <input
              type="text"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={candidatesLoading ? 'Loading candidates…' : 'Candidate email (required)'}
              disabled={uploading || candidatesLoading}
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
              aria-label="Candidate email"
              aria-expanded={showDropdown}
            />
            {/* Candidate email dropdown — pick from registered candidates */}
            {showDropdown && candidates.length > 0 && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setShowDropdown(false)} />
                <div className="absolute left-0 right-0 top-full z-[61] mt-1 max-h-44 overflow-y-auto rounded-lg border border-border/60 bg-popover py-1 shadow-2xl">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-muted-foreground">No matching candidates</p>
                  ) : (
                    filtered.slice(0, 20).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setEmail(c.email)
                          setShowDropdown(false)
                          setError('')
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-accent"
                      >
                        <span className="truncate font-medium text-foreground">{c.full_name}</span>
                        <span className="ml-auto truncate text-muted-foreground">{c.email}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
          <div>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Job title (optional)"
              disabled={uploading}
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
              aria-label="Job title"
            />
          </div>
          {error && <p className="text-[11px] font-medium text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" loading={uploading} className="h-8 px-3 text-xs">
              <Paperclip />
              Upload & process
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={uploading}
              className="h-8 px-3 text-xs"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ChatSidebar({ role }: ChatSidebarProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const voice = useVoice()

  const suggestions = role === 'admin' ? ADMIN_SUGGESTIONS : CANDIDATE_SUGGESTIONS

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [])

  useEffect(() => {
    if (open) scrollToBottom()
  }, [messages, open, scrollToBottom])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // Fresh session per mount — no memory is stored between refreshes.
  const reset = useCallback(() => {
    abortRef.current?.abort()
    voice.stop()
    setMessages([])
    setInput('')
    setStreaming(false)
    setUploading(false)
    setPendingUpload(null)
  }, [voice])

  const handleFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || role !== 'admin' || streaming || uploading || pendingUpload) return

      const userMsg: DisplayMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: 'Uploaded an interview recording for processing.',
        attachment: { name: file.name, size: file.size },
      }
      setMessages((prev) => [...prev, userMsg])
      setPendingUpload({ file })
    },
    [role, streaming, uploading, pendingUpload],
  )

  /** Executed from the in-chat upload form — no native browser prompts. */
  const uploadFile = useCallback(
    async (file: File, candidateEmail: string, jobTitle: string) => {
      setUploading(true)
      try {
        const res = await chatApi.uploadInterview(file, candidateEmail.trim(), jobTitle)
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content:
              `✅ Interview **${file.name}** uploaded for **${res.candidate_email}** (` +
              `${res.status}). Processing has started automatically — I'll track it and ` +
              `can email the result once it's ready. Just ask!`,
            streaming: false,
          },
        ])
      } catch (error) {
        const message =
          (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Upload failed. Please try again.'
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: `⚠️ ${message}`, streaming: false },
        ])
      } finally {
        setUploading(false)
        setPendingUpload(null)
      }
    },
    [],
  )

  const send = useCallback(
    async (text?: string) => {
      const message = (text ?? input).trim()
      if (!message || streaming) return

      const userMsg: DisplayMessage = { id: `u-${Date.now()}`, role: 'user', content: message }
      const assistantMsg: DisplayMessage = {
        id: `a-${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        streaming: true,
      }
      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setInput('')
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      // History is sent with the request and is never stored server-side.
      const history: ChatHistoryItem[] = messages
        .filter((m) => m.content)
        .map((m) => ({ role: m.role, content: m.content }))

      try {
        await streamChat(
          { message, history },
          {
            onMessage: (delta) => {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + delta } : m)),
              )
            },
            onDone: (content) => {
              const finalContent = content || ''
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: finalContent || m.content, streaming: false }
                    : m,
                ),
              )
              // No auto-speak — text is generated silently. The user clicks
              // the small speaker icon under a message to hear it.
            },
            onError: (errorMessage) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content || `⚠️ ${errorMessage}`, streaming: false }
                    : m,
                ),
              )
            },
          },
          controller.signal,
        )
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content || '⚠️ Something went wrong. Please try again.', streaming: false }
                : m,
            ),
          )
        }
      } finally {
        setStreaming(false)
      }
    },
    [input, messages, streaming, voice],
  )

  const panel = (
    <div className="flex h-full min-h-0 flex-col bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary/10 to-transparent px-4 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-glow">
          <Bot className="h-5 w-5 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            HireLens AI <Sparkles className="h-3.5 w-3.5 text-primary" />
          </p>
          <p className="text-[11px] text-muted-foreground">
            {role === 'admin' ? 'Platform operations · live data' : 'Your interview assistant'}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={reset} title="Start a new chat">
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> New chat
        </Button>
      </div>

      {/* Scrollable messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">How can I help you?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                I work with live platform data — every answer is fetched fresh.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={streaming}
                  className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                speaking={voice.state === 'playing' && voice.text === m.content}
                paused={voice.state === 'paused' && voice.text === m.content}
                onSpeak={(text) => {
                  // Play/pause/resume the exact message when its icon is clicked.
                  const isThis = voice.text === text
                  if (isThis && (voice.state === 'playing' || voice.state === 'paused')) {
                    voice.state === 'playing' ? voice.pause() : voice.resume()
                  } else {
                    void voice.speak(text)
                  }
                }}
              />
            ))}
            {pendingUpload && (
              <UploadDetailsForm
                fileName={pendingUpload.file.name}
                fileSize={pendingUpload.file.size}
                uploading={uploading}
                onSubmit={(email, jobTitle) => void uploadFile(pendingUpload.file, email, jobTitle)}
                onCancel={() => setPendingUpload(null)}
              />
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border/60 p-3">
        <div className="flex items-end gap-2">
          {role === 'admin' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_ATTACHMENTS}
                className="hidden"
                onChange={handleFileSelected}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming || uploading}
                className="h-10 w-10 shrink-0 text-muted-foreground/70 hover:text-primary"
                aria-label="Attach interview recording"
                title="Attach interview recording (audio/video)"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </Button>
            </>
          )}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Ask HireLens AI…"
            disabled={streaming}
            className="min-h-[40px] max-h-28 resize-none bg-muted/40 text-[13px]"
            rows={1}
          />
          <Button
            onClick={() => send()}
            disabled={streaming || !input.trim()}
            size="icon"
            className="h-10 w-10 shrink-0"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {role === 'admin'
            ? 'Attach an interview recording to upload & process it, or ask me to email a result.'
            : 'Verify important actions before confirming. Data is always fetched live.'}
        </p>
      </div>
    </div>
  )

  return (
    <>
      {/* Floating launcher (all screen sizes) */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open AI assistant'}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-white shadow-glow transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Panel overlay: slides in from the right, does NOT affect page layout */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border/60 bg-card shadow-2xl sm:w-[400px]">
            {panel}
          </aside>
        </>
      )}
    </>
  )
}
