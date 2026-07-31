import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Loader2, MessageCircle, Send, Sparkles, Wrench, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { streamChat } from '@/services/api'
import type { ChatHistoryItem, StreamToolEvent } from '@/types'
import { cn } from '@/lib/utils'

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolEvents: StreamToolEvent[]
  streaming?: boolean
}

interface ChatWidgetProps {
  role: 'admin' | 'candidate'
}

const ADMIN_SUGGESTIONS = ['Show dashboard stats', 'List candidates', 'Hiring analytics']
const CANDIDATE_SUGGESTIONS = ['My interview status', 'What is my result?', 'My profile']

function renderMarkdown(text: string): string {
  let out = text
    .replace(/```([\s\S]*?)```/g, (_m, code) => `\n\`${code.trim()}\`\n`)
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">$1</code>')
    .replace(/^### (.+)$/gm, '<h4 class="mt-3 mb-1 font-semibold text-foreground">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="mt-3 mb-1 font-semibold text-foreground">$1</h3>')
    .replace(/^# (.+)$/gm, '<h3 class="mt-3 mb-1 font-semibold text-foreground">$1</h3>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n/g, '<br/>')
  return out
}

export function ChatWidget({ role }: ChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const suggestions = role === 'admin' ? ADMIN_SUGGESTIONS : CANDIDATE_SUGGESTIONS

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
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
    setMessages([])
    setInput('')
    setStreaming(false)
  }, [])

  const send = useCallback(
    async (text?: string) => {
      const message = (text ?? input).trim()
      if (!message || streaming) return

      const userMsg: DisplayMessage = { id: `u-${Date.now()}`, role: 'user', content: message, toolEvents: [] }
      const assistantMsg: DisplayMessage = {
        id: `a-${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        toolEvents: [],
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
            onTool: (tool) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, toolEvents: [...m.toolEvents, tool as StreamToolEvent] } : m,
                ),
              )
            },
            onDone: (content) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: content || m.content, streaming: false } : m,
                ),
              )
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
    [input, messages, streaming],
  )

  return (
    <>
      {/* Floating launcher button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open AI assistant'}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-white shadow-glow transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[min(600px,calc(100vh-8rem))] w-[min(400px,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary/10 to-transparent px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark">
              <Bot className="h-5 w-5 text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                HireLens AI
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </p>
              <p className="text-[11px] text-muted-foreground">
                {role === 'admin' ? 'Platform operations · live data' : 'Your interview assistant'}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={reset}>
              New chat
            </Button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
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
                <div key={m.id} className={cn('flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
                  {m.role === 'assistant' && (
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-dark">
                      <Bot className="h-3.5 w-3.5 text-white" />
                    </span>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed',
                      m.role === 'user'
                        ? 'rounded-br-md bg-primary text-primary-foreground'
                        : 'rounded-bl-md border border-border/60 bg-muted/40 text-foreground',
                    )}
                  >
                    {m.role === 'assistant' ? (
                      <div
                        className="chat-markdown [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}

                    {m.role === 'assistant' && m.toolEvents.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
                        {m.toolEvents.map((t, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Wrench className="h-3 w-3" />
                            <span className="font-mono">{t.name}</span>
                            <span className="text-primary">
                              {t.status === 'started' ? '…' : t.status === 'done' ? '✓' : '✗'}
                            </span>
                            {t.error && <span className="truncate text-destructive">({t.error})</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {m.streaming && (
                      <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> HireLens is thinking…
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border/60 p-3">
            <div className="flex items-end gap-2">
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
              Verify important actions before confirming. Data is always fetched live.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
