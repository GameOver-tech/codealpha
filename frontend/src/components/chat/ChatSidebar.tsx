import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Loader2, MessageCircle, Paperclip, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { chatApi, streamChat } from '@/services/api'
import type { ChatHistoryItem } from '@/types'
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

interface ChatSidebarProps {
  role: 'admin' | 'candidate'
}

const ACCEPTED_ATTACHMENTS = 'video/*,audio/*,image/*,.mp4,.mov,.avi,.mkv,.mp3,.wav,.m4a,.flac,.aac'

// Memoized so streaming deltas only re-render the message being updated.
const MessageBubble = memo(function MessageBubble({
  message,
  speaking,
  paused,
}: {
  message: DisplayMessage
  speaking: boolean
  paused: boolean
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
          <div
            className="chat-markdown [&_a]:break-all [&_table]:my-1 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
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

export function ChatSidebar({ role }: ChatSidebarProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [uploading, setUploading] = useState(false)
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
  }, [voice])

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || role !== 'admin' || streaming || uploading) return

      setUploading(true)
      const userMsg: DisplayMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: 'Uploaded an interview recording for processing.',
        attachment: { name: file.name, size: file.size },
      }
      setMessages((prev) => [...prev, userMsg])

      const candidateEmail = window.prompt('Candidate email (the interview belongs to):')
      if (!candidateEmail?.trim()) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: 'Upload cancelled — no candidate email provided.', streaming: false },
        ])
        setUploading(false)
        return
      }

      const jobTitle = window.prompt('Job title (optional):')?.trim() || 'Interview'

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
      }
    },
    [role, streaming, uploading],
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
              // ChatGPT-style: speak the finished response automatically.
              if (voice.settings.autoPlay && finalContent.trim()) {
                voice.speak(finalContent)
              }
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
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              speaking={voice.state === 'playing' && voice.text === m.content}
              paused={voice.state === 'paused' && voice.text === m.content}
            />
          ))
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
