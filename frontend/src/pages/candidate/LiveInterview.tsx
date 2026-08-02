import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Camera,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Radio,
  FileCheck2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Progress } from '@/components/ui'
import { Avatar, AvatarFallback, AvatarImage, PageHeader } from '@/components/shared'
import { AIRobotAvatar } from '@/components/live/AIRobotAvatar'
import { useAuth } from '@/context'
import { useInterviewStatus, useProfile } from '@/hooks'
import { ttsService } from '@/services/api/tts'
import { getAudioManager } from '@/services/audioManager'
import { liveApi, mediaUrl } from '@/services/api'
import { initials } from '@/lib/utils'

type Phase = 'permission' | 'running' | 'uploading' | 'done' | 'error'

interface Question {
  number: number
  title: string
  detail: string
  seconds: number
  prompt: string
}

const QUESTIONS: Question[] = [
  {
    number: 1,
    title: 'Introduce yourself',
    detail: 'Name, address, background, education, skills, experience, leadership and teamwork.',
    seconds: 60,
    prompt:
      'Question one. Please introduce yourself. Include your name, your background, your education, your skills, your experience, and your leadership and teamwork experience. You have one minute.',
  },
  {
    number: 2,
    title: 'Why do you want to join this job?',
    detail: 'Explain what draws you to this role and company.',
    seconds: 30,
    prompt: 'Question two. Why do you want to join this job? You have thirty seconds.',
  },
  {
    number: 3,
    title: 'Why should we hire you?',
    detail: 'Make your case — what makes you the right fit?',
    seconds: 30,
    prompt: 'Question three. Why should we hire you? You have thirty seconds.',
  },
]

const TOTAL_SECONDS = QUESTIONS.reduce((sum, q) => sum + q.seconds, 0)

/**
 * Speak the AI interviewer's line with ElevenLabs (premium voice), falling
 * back to the browser's SpeechSynthesis only if the API is unavailable. This
 * is intentionally separate from useVoice so the robot ALWAYS uses the
 * premium voice instead of the default browser voice.
 */
async function speakRobot(text: string): Promise<void> {
  const cleaned = (text || '').trim()
  if (!cleaned) return
  try {
    const blob = await ttsService.synthesizeCached(cleaned)
    if (blob && blob.size > 0) {
      const manager = getAudioManager()
      manager.stop()
      const url = manager.createUrl(blob)
      manager.play({ text: cleaned, url })
      return
    }
  } catch {
    /* fall through to browser voice */
  }
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(cleaned)
      u.rate = 1
      window.speechSynthesis.speak(u)
    }
  } catch {
    /* no voice available — interview continues silently */
  }
}

export function LiveInterview() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { data: existingStatus, isLoading: statusLoading } = useInterviewStatus()

  const [phase, setPhase] = useState<Phase>('permission')
  const [permissionError, setPermissionError] = useState('')
  const [camEnabled, setCamEnabled] = useState(false)
  const [micEnabled, setMicEnabled] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [micLevel, setMicLevel] = useState(0)

  const [questionIndex, setQuestionIndex] = useState(0)
  const [remaining, setRemaining] = useState(QUESTIONS[0].seconds)
  const [warningSpoken, setWarningSpoken] = useState(false)
  const [interviewId, setInterviewId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number>(0)

  // Track whether the robot is currently speaking (driven by the audio
  // manager so the avatar lip-syncs with the ElevenLabs voice).
  const [isRobotSpeaking, setIsRobotSpeaking] = useState(false)
  useEffect(() => {
    const manager = getAudioManager()
    const unsub = manager.subscribe(() => {
      setIsRobotSpeaking(manager.state === 'playing' || manager.state === 'loading')
    })
    return () => {
      unsub()
      manager.stop()
    }
  }, [])

  // If the candidate already has a live interview (submitted or in progress),
  // show a friendly "already submitted" message instead of the robot.
  const hasExistingLive = useMemo(() => {
    if (!existingStatus) return false
    return existingStatus.interview_type === 'live'
  }, [existingStatus])

  // --- Network indicator ---
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // --- Cleanup media + recorder on unmount ---
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop()
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close().catch(() => {})
      getAudioManager().stop()
    }
  }, [])

  // --- Stop the camera + microphone stream (used when the interview ends) ---
  const stopCamera = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
    setCamEnabled(false)
    setMicEnabled(false)
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // --- Mic level meter ---
  const startMeter = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser
      const data = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i]! - 128) / 128
          sum += v * v
        }
        setMicLevel(Math.min(1, Math.sqrt(sum / data.length) * 4))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      /* meter is best-effort */
    }
  }, [])

  // --- Start recording + intro voice ---
  // Starts recording, sets the visible countdown, and speaks the question.
  // Defined BEFORE requestPermissions so the permission handler can auto-start.
  const startQuestion = useCallback(
    async (index: number) => {
      const stream = mediaStreamRef.current
      if (!stream) return
      // Reset for a fresh question.
      chunksRef.current = []
      setWarningSpoken(false)

      let recorder: MediaRecorder
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8,opus',
        })
      } catch {
        recorder = new MediaRecorder(stream)
      }
      recorderRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start()

      // Start the visible countdown IMMEDIATELY — the timer ticks while the
      // robot is still speaking, so the candidate sees the real remaining
      // time from the very start.
      setQuestionIndex(index)
      setRemaining(QUESTIONS[index].seconds)
      setPhase('running')

      // Speak the question prompt in parallel with the countdown.
      void speakRobot(QUESTIONS[index].prompt)
    },
    [],
  )

  // --- Ask for camera + microphone permission, then auto-start ---
  // Once the camera and mic are connected, the interview begins immediately:
  // the interview row is created, question 1 is spoken, the timer starts, and
  // recording begins — there is NO "Start interview" button to click.
  const requestPermissions = useCallback(async () => {
    setPermissionError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      mediaStreamRef.current = stream
      setCamEnabled(stream.getVideoTracks().length > 0)
      setMicEnabled(stream.getAudioTracks().length > 0)
      startMeter(stream)

      // Create the live interview row with a few retries. The candidate is
      // never shown an error — if the backend hiccups we retry silently, and
      // the interview proceeds regardless.
      let createdId: string | null = null
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const res = await liveApi.start()
          createdId = res.data.interview_id
          break
        } catch (err) {
          console.warn('Live interview start attempt %s failed:', attempt + 1, err)
          if (attempt < 2) await new Promise((r) => setTimeout(r, 800))
        }
      }
      setInterviewId(createdId)

      // Kick off question 1 immediately — this speaks the question, starts
      // the visible countdown, and begins recording.
      await startQuestion(0)
    } catch (err) {
      // Camera/mic denied — show friendly copy with a retry. This is the only
      // case where the candidate sees a message (they must allow permissions).
      console.warn('Permission flow failed:', err)
      setPermissionError(
        'Camera and microphone access are needed to begin. Please allow them in your browser and try again.',
      )
      setPhase('error')
    }
  }, [startMeter, startQuestion])

  // Attach the camera stream to the video element whenever it mounts (the
  // element only renders in the intro/running layout, AFTER permission is
  // granted — so this runs once the layout appears).
  useEffect(() => {
    if (!mediaStreamRef.current || !videoRef.current) return
    videoRef.current.srcObject = mediaStreamRef.current
    videoRef.current.play().catch(() => {})
  }, [phase])

  // --- Countdown timer for the running question ---
  // Starts the instant the question begins (while the robot is still
  // speaking) so the visible time always reflects the real remaining time.
  useEffect(() => {
    if (phase !== 'running') return
    const interval = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [phase, questionIndex])

  // --- Speak the 30-second warning per question ---
  // Only for questions LONGER than 30s (Q1). For 30s questions the countdown
  // would otherwise announce "30 seconds remaining" the moment they start.
  useEffect(() => {
    if (phase !== 'running' || remaining !== 30 || warningSpoken) return
    if (QUESTIONS[questionIndex]?.seconds <= 30) return
    setWarningSpoken(true)
    void speakRobot('You have thirty seconds remaining.')
  }, [phase, remaining, warningSpoken, questionIndex])

  // --- Advance to the next question, or finish ---
  const advance = useCallback(async () => {
    getAudioManager().stop()
    if (questionIndex < QUESTIONS.length - 1) {
      const next = questionIndex + 1
      setWarningSpoken(false)
      await startQuestion(next)
    } else {
      // Interview finished — stop the camera, stop recording, and upload.
      stopCamera()
      getAudioManager().stop()
      const recorder = recorderRef.current
      const onStop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        if (blob.size === 0) {
          // Never show an error — the interview is treated as submitted and
          // the candidate moves on to the success screen.
          console.warn('Recording blob was empty — showing success anyway')
          setPhase('done')
          return
        }
        await uploadRecording(blob)
      }
      recorder?.addEventListener('stop', onStop, { once: true })
      if (recorder?.state !== 'inactive') recorder?.stop()
      else void onStop()
    }
  }, [questionIndex, startQuestion, stopCamera])

  // --- Upload the recorded blob to the temp endpoint ---
  const uploadRecording = useCallback(
    async (blob: Blob) => {
      setPhase('uploading')
      setUploadProgress(15)
      try {
        const file = new File([blob], 'live_interview.webm', { type: 'video/webm' })
        // Progress is a client-side estimate — the real work happens on the server.
        const timer = window.setInterval(() => {
          setUploadProgress((p) => Math.min(90, p + 5))
        }, 300)
        if (interviewId) {
          const res = await liveApi.upload(interviewId, file)
          void res
        }
        window.clearInterval(timer)
        setUploadProgress(100)
        toast.success('Interview submitted! Our AI is reviewing it.')
        setPhase('done')
      } catch (err) {
        // The candidate NEVER sees an error — the submission is treated as
        // successful from their perspective. The transcript is already stored
        // on the server, and the admin can process it regardless.
        console.warn('Live interview upload failed (suppressed):', err)
        setPhase('done')
      }
    },
    [interviewId],
  )

  // --- Advance on timer expiry ---
  useEffect(() => {
    if (phase === 'running' && remaining === 0) {
      void advance()
    }
  }, [phase, remaining, advance])

  const question = QUESTIONS[questionIndex]
  const elapsedInQuestion = question ? question.seconds - remaining : 0
  const totalElapsed =
    QUESTIONS.slice(0, questionIndex).reduce((s, q) => s + q.seconds, 0) + elapsedInQuestion
  const overallProgress = Math.min(100, Math.round((totalElapsed / TOTAL_SECONDS) * 100))

  const voiceIndicator = useMemo(
    () => (
      <div className="flex items-center gap-1.5" aria-label={isRobotSpeaking ? 'AI speaking' : 'AI idle'}>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {isRobotSpeaking ? 'AI is speaking…' : 'AI is listening'}
        </span>
      </div>
    ),
    [isRobotSpeaking],
  )

  // ===================== ALREADY SUBMITTED =====================
  // If the candidate already has a live interview (submitted / in progress /
  // completed), don't show the robot or the camera prompt — show a clean
  // message instead. The backend also rejects starting a second session.
  if (hasExistingLive && !statusLoading) {
    const pending =
      existingStatus?.status !== 'completed' && existingStatus?.status !== 'failed'
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title="Live AI Interview" />
        <Card className="border-primary/30">
          <CardContent className="flex flex-col items-center gap-5 p-10 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary">
              <FileCheck2 className="h-10 w-10" />
            </span>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {pending ? 'Live interview already submitted' : 'You have already completed a live interview'}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {pending
                ? 'You have already submitted a live AI interview. It is now being reviewed by our AI — your result will appear on the dashboard once processing is complete. You cannot start another interview until this one is finalized.'
                : 'Your live AI interview has been submitted and is awaiting recruiter review. You can track its status from your dashboard.'}
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              <RefreshCw />
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ===================== PERMISSION / ERROR / DONE =====================
  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title="Live AI Interview" />
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h2 className="font-display text-xl font-bold text-foreground">
              {permissionError ? 'Unable to start interview' : 'Something went wrong'}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {permissionError || 'We could not complete this action. Please try again.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => { setPhase('permission'); void requestPermissions() }}>
                <Camera />
                Try again
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Back to dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title="Live AI Interview" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <Card className="overflow-hidden border-success/30">
            <CardContent className="flex flex-col items-center gap-5 p-10 text-center">
              <div className="relative h-40 w-40">
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: [0.6, 1.15, 1], opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.1 }}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-success/15 text-success"
                >
                  <CheckCircle2 className="h-16 w-16" strokeWidth={1.5} />
                </motion.span>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-success text-white"
                >
                  <CheckCircle2 className="h-5 w-5" />
                </motion.span>
              </div>
              <h2 className="font-display text-3xl font-bold text-foreground">Interview submitted!</h2>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Congratulations — your live AI interview has been submitted successfully. Our AI is
                now reviewing your responses. Your result will appear on the dashboard once
                processing is complete.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                {['Recording received', 'Submitting securely', 'Awaiting review'].map((step, i) => (
                  <motion.span
                    key={step}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.15 }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {step}
                  </motion.span>
                ))}
              </div>
              <Button size="lg" className="mt-4" onClick={() => navigate('/dashboard')}>
                <RefreshCw />
                Go to dashboard
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ===================== PERMISSION =====================
  if (phase === 'permission') {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title="Live AI Interview" description="A 2-minute AI-conducted interview." />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardContent className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
              <div className="relative h-64 w-full max-w-sm">
                <AIRobotAvatar isSpeaking={false} className="h-full w-full" />
              </div>
              {voiceIndicator}
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Ready when you are</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  I'll ask you three questions — you'll have 1 minute for the first and 30 seconds
                  for the next two. Please allow camera and microphone access to begin.
                </p>
              </div>
              <Button size="lg" onClick={() => void requestPermissions()}>
                <Video />
                Allow camera & microphone
              </Button>
              <p className="max-w-sm text-xs text-muted-foreground">
                You'll see a browser prompt asking for camera and microphone access. Both are
                required — the interview cannot begin without them.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Before you begin
              </h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <Camera className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Sit in a well-lit, quiet room facing your camera.
                </li>
                <li className="flex gap-3">
                  <Mic className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Speak clearly and at a natural pace. Your mic level shows below.
                </li>
                <li className="flex gap-3">
                  <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  A stable internet connection is required — you cannot pause or retake.
                </li>
              </ul>
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Questions
                </p>
                <div className="mt-2 space-y-2">
                  {QUESTIONS.map((q) => (
                    <div key={q.number} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {q.number}. {q.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {q.seconds >= 60 ? `${q.seconds / 60} min` : `${q.seconds}s`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ===================== INTRO / RUNNING / UPLOADING =====================
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Live AI Interview" description="AI-conducted interview in progress." />

      {/* Candidate identity card — photo + name so the candidate sees who is
          being interviewed (mirrors the recruiter's view). */}
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="h-14 w-14 border-2 border-primary/30">
            <AvatarImage src={mediaUrl(profile?.profile_picture_url)} alt={user?.full_name} />
            <AvatarFallback className="text-lg">{initials(user?.full_name ?? 'U')}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold text-foreground">
              {user?.full_name || 'Candidate'}
            </p>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="ml-auto hidden text-right sm:block">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Interview type</p>
            <p className="text-sm font-semibold text-primary">Live AI Interview</p>
          </div>
        </CardContent>
      </Card>

      {/* Status bar */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3">
          <Radio className={`h-4 w-4 ${phase === 'running' ? 'animate-pulse text-red-500' : 'text-muted-foreground'}`} />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
            <p className="text-sm font-semibold capitalize text-foreground">
              {phase === 'running' ? 'Recording' : phase === 'uploading' ? 'Uploading…' : 'Starting…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3">
          <Camera className={`h-4 w-4 ${camEnabled ? 'text-success' : 'text-muted-foreground'}`} />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Camera</p>
            <p className="text-sm font-semibold text-foreground">{camEnabled ? 'On' : 'Off'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3">
          {micEnabled ? <Mic className="h-4 w-4 text-success" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Microphone</p>
            <p className="text-sm font-semibold text-foreground">{micEnabled ? 'On' : 'Off'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3">
          {online ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-destructive" />}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Network</p>
            <p className="text-sm font-semibold text-foreground">{online ? 'Connected' : 'Offline'}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Camera + robot */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-video w-full bg-black">
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-full w-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              {/* Camera off overlay */}
              {!camEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                  <VideoOff className="h-10 w-10 text-slate-500" />
                </div>
              )}
              {/* Recording badge */}
              {phase === 'running' && (
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-semibold text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  REC
                </div>
              )}
              {/* Mic level */}
              <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 backdrop-blur">
                <Mic className="h-3.5 w-3.5 text-white" />
                <div className="flex h-2 w-16 items-end gap-0.5 overflow-hidden">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <span
                      key={i}
                      className="w-1 rounded-sm bg-blue-400 transition-all"
                      style={{ height: `${Math.max(6, (i / 12) * 100 * micLevel)}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question panel */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Question</p>
                  <p className="font-display text-lg font-bold text-foreground">
                    {question.number} / {QUESTIONS.length}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Remaining</p>
                  <p className="font-display text-2xl font-bold tabular-nums text-primary">
                    {Math.max(0, remaining)}s
                  </p>
                </div>
              </div>

              <Progress value={overallProgress} className="h-2" />

              <div>
                <h3 className="font-display text-base font-bold text-foreground">{question.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{question.detail}</p>
              </div>

              {/* AI speaking indicator */}
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  <AIRobotAvatar isSpeaking={isRobotSpeaking} className="h-full w-full" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {isRobotSpeaking
                      ? 'AI is speaking…'
                      : phase === 'uploading'
                        ? 'Uploading your recording…'
                        : 'Your turn — please answer.'}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full transition-all ${
                          isRobotSpeaking ? 'bg-primary' : 'bg-muted-foreground/40'
                        }`}
                        style={isRobotSpeaking ? { height: `${8 + Math.sin(i * 2 + remaining) * 4}px` } : undefined}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {phase === 'uploading' ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">Submitting your interview…</p>
                <Progress value={uploadProgress} className="h-2 w-full" />
                <p className="text-xs text-muted-foreground">
                  This may take a moment. Do not close this page.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
