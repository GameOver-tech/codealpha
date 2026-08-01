import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, PlayCircle, Sparkles, Upload, FileText, Brain, LineChart, Trophy, Plus, Star, Zap, ShieldCheck } from 'lucide-react'
import { CTAButton } from '@/components/shared'

/* Per-word headline reveal: rise with a crisp settle and gradient highlight on key words */
function Word({ children, gradient }: { children: React.ReactNode; gradient?: boolean }) {
  return (
    <motion.span
      variants={{
        hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
        show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }}
      className={gradient ? 'relative inline-block text-gradient animate-gradient-shift' : 'inline-block'}
    >
      {gradient && (
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.1, duration: 0.6, ease: 'easeOut' }}
          className="absolute -bottom-1 left-0 right-0 h-[3px] origin-left rounded-full bg-gradient-to-r from-primary via-blue-400 to-primary opacity-60"
        />
      )}
      {children}
    </motion.span>
  )
}

/* 3D holographic data panel with readable text and real depth */
function HoloPanel({
  icon: Icon,
  iconClass,
  title,
  desc,
  className = '',
  delay = 0.9,
  tilt,
  success = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconClass?: string
  title: string
  desc: string
  className?: string
  delay?: number
  tilt: { rotateY: number; rotateX: number; z: number }
  success?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{
        transformStyle: 'preserve-3d',
        transform: `rotateY(${tilt.rotateY}deg) rotateX(${tilt.rotateX}deg) translateZ(${tilt.z}px)`,
      }}
      className={`absolute hidden rounded-2xl border border-white/50 bg-white/75 p-3 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80 md:block ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass ?? 'bg-primary/10 text-primary'}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className={`text-xs font-bold leading-tight ${success ? 'text-success' : 'text-foreground'}`}>{title}</p>
          <p className="text-[10px] leading-tight text-muted-foreground">{desc}</p>
        </div>
      </div>
    </motion.div>
  )
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-24 md:pb-28 md:pt-28">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/20 via-blue-400/10 to-transparent blur-3xl" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(15_23_42/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(15_23_42/0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_70%,transparent_110%)] dark:bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)]" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI-powered interview evaluation
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } } }}
            className="mt-4 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            <span className="block">
              <Word>AI-powered</Word>{' '}
              <Word gradient>hiring intelligence</Word>{' '}
              <Word>for</Word>{' '}
              <Word>smarter</Word>{' '}
              <Word>talent</Word>{' '}
              <Word>decisions</Word>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-5 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground"
          >
            Upload interview recordings and get deep, data-driven insights — speech analysis,
            sentiment detection, skill scoring, and hiring recommendations in minutes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-7 flex flex-wrap items-center gap-4"
          >
            <CTAButton to="/register">Start Interview</CTAButton>
            <CTAButton to="/login" variant="outline">
              For Recruiters
            </CTAButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-success" /> Free to get started
            </span>
            <span className="inline-flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-success" /> 30-minute interviews
            </span>
            <span className="inline-flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-success" /> Instant AI reports
            </span>
          </motion.div>

          {/* Proof bar: social proof to convert in the first seconds */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-border/60 pt-6"
          >
            {[
              { icon: Star, value: '4.9/5', label: 'Recruiter rating' },
              { icon: Zap, value: '10×', label: 'Faster screening' },
              { icon: ShieldCheck, value: '100%', label: 'Data secure' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                <s.icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-display text-sm font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Hero visual: AI brain hologram with real 3D data panels */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="relative mx-auto flex w-full max-w-[620px] items-center justify-center"
        >
          {/* Hologram stage */}
          <div className="relative w-full" style={{ perspective: '1400px' }}>
            {/* Rotating conic light rays */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 animate-spin-slow rounded-full"
              style={{
                background:
                  'conic-gradient(from 0deg, transparent 0deg, rgba(59,130,246,0.08) 30deg, transparent 60deg, transparent 120deg, rgba(59,130,246,0.08) 150deg, transparent 180deg, transparent 240deg, rgba(59,130,246,0.08) 270deg, transparent 300deg)',
                maskImage: 'radial-gradient(circle, black 0%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 70%)',
              }}
            />
            {/* Brain core — masked to the center so the image's baked-in text edges fade out */}
            <div className="relative animate-float">
              <div className="absolute inset-0 -z-10 animate-pulse-ring rounded-full bg-blue-400/15 blur-xl" />
              <div className="absolute inset-0 -z-10 animate-pulse-ring rounded-full bg-blue-400/15 blur-xl [animation-delay:1s]" />
              <div className="animate-breathe">
                <img
                  src="/ai-brain-opt.png"
                  srcSet="/ai-brain-opt.png 1280w, /ai-brain.png 10240w"
                  sizes="(min-width: 1024px) 620px, (min-width: 640px) 50vw, 100vw"
                  alt="AI brain hologram"
                  loading="lazy"
                  decoding="async"
                  className="mx-auto h-auto w-[78%] max-w-[500px] object-contain"
                  style={{
                    maskImage: 'radial-gradient(ellipse 62% 62% at center, black 55%, transparent 100%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 62% 62% at center, black 55%, transparent 100%)',
                  }}
                />
                {/* Scanline sweeping the hologram */}
                <div className="pointer-events-none absolute inset-x-8 h-24 animate-scanline rounded-full bg-gradient-to-b from-transparent via-blue-400/10 to-transparent" />
              </div>
            </div>

            {/* Orbiting light particles */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0"
              style={{ ['--orbit-r' as string]: 'min(42%, 140px)' }}
            >
              <span className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-orbit rounded-full bg-blue-400/80" />
              <span
                className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 animate-orbit rounded-full bg-primary/70"
                style={{ animationDelay: '3s' }}
              />
              <span
                className="absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 animate-orbit rounded-full bg-cyan-300/80"
                style={{ animationDelay: '6s' }}
              />
            </div>

            {/* Real 3D holographic data panels — readable logic in one second */}
            <HoloPanel
              delay={0.85}
              className="-left-2 top-8 md:-left-6"
              tilt={{ rotateY: 18, rotateX: -6, z: 60 }}
              icon={Upload}
              iconClass="bg-primary/15 text-primary"
              title="Upload"
              desc="Drop interview video"
            />
            <HoloPanel
              delay={1.0}
              className="-right-2 top-16 md:-right-6"
              tilt={{ rotateY: -18, rotateX: -6, z: 80 }}
              icon={Brain}
              iconClass="bg-blue-500/15 text-blue-500"
              title="AI Analysis"
              desc="Speech + sentiment"
            />
            <HoloPanel
              delay={1.15}
              className="bottom-10 left-2 md:left-0"
              tilt={{ rotateY: 14, rotateX: 8, z: 40 }}
              icon={LineChart}
              iconClass="bg-primary/15 text-primary"
              title="Skill Score"
              desc="92 / 100"
            />
            <HoloPanel
              delay={1.3}
              className="bottom-4 right-2 md:right-2"
              tilt={{ rotateY: -14, rotateX: 8, z: 50 }}
              icon={Trophy}
              iconClass="bg-success/15 text-success"
              title="Verdict"
              desc="Recommended"
              success
            />
          </div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1 }}
        className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block"
      >
        <div className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-muted-foreground/30 p-1.5">
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="h-2 w-1 rounded-full bg-primary"
          />
        </div>
      </motion.div>
    </section>
  )
}

const STEPS = [
  { icon: Upload, title: 'Upload', description: 'Submit the interview recording securely.' },
  { icon: FileText, title: 'Transcribe', description: 'AI converts speech to accurate text.' },
  { icon: Brain, title: 'Analyze', description: 'Speech, sentiment and skills are evaluated.' },
  { icon: LineChart, title: 'Report', description: 'A full report with scores is generated.' },
  { icon: Trophy, title: 'Recommendation', description: 'Get a clear hiring recommendation.' },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section-padding border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            How it works
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From recording to recommendation in minutes
          </h2>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="mx-auto mt-3 h-1 w-20 origin-center rounded-full bg-gradient-to-r from-primary via-blue-400 to-primary"
          />
          <p className="mt-4 text-muted-foreground">
            A fully automated pipeline that turns raw interview recordings into actionable hiring intelligence.
          </p>
        </div>

        <div className="relative mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {/* Animated connector line on large screens */}
          <div className="pointer-events-none absolute left-[10%] right-[10%] top-14 hidden h-0.5 lg:block">
            <div className="h-full w-full origin-left bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10" />
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className="absolute inset-0 origin-left bg-gradient-to-r from-primary via-blue-400 to-primary"
            />
          </div>
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="group relative rounded-2xl border border-border/60 bg-card p-6 text-center shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-card"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-blue-400/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:from-primary group-hover:to-primary-dark group-hover:text-white group-hover:shadow-glow">
                <step.icon className="h-7 w-7" />
              </div>
              <span className="absolute right-4 top-4 bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-xs font-bold text-transparent">
                0{i + 1}
              </span>
              <h3 className="mt-4 font-display text-base font-bold text-foreground">{step.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const FEATURES = [
  {
    icon: Brain,
    title: 'Deep AI Analysis',
    description: 'Speech patterns, sentiment, tone and confidence are evaluated by advanced AI models.',
  },
  {
    icon: LineChart,
    title: 'Comprehensive Scores',
    description: 'Technical skills, communication, problem solving and more — scored from 0 to 100.',
  },
  {
    icon: FileText,
    title: 'Professional Reports',
    description: 'Beautiful, downloadable PDF reports with executive summaries and evidence.',
  },
  {
    icon: Upload,
    title: 'Instant Uploads',
    description: 'Drag and drop MP4, MOV, MP3, WAV and more. Processing starts automatically.',
  },
  {
    icon: BadgeCheck,
    title: 'Hiring Recommendations',
    description: 'Clear verdicts: Recommended, Not Recommended, or Need Further Review.',
  },
  {
    icon: PlayCircle,
    title: 'Full Transcripts',
    description: 'Timestamped, speaker-labeled transcripts with every insight backed by evidence.',
  },
]

export function Features() {
  return (
    <section id="features" className="section-padding">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            Features
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need to evaluate talent
          </h2>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="mx-auto mt-3 h-1 w-20 origin-center rounded-full bg-gradient-to-r from-primary via-blue-400 to-primary"
          />
          <p className="mt-4 text-muted-foreground">
            Built for recruiters and candidates who want clarity, speed and fairness in hiring.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                e.currentTarget.style.setProperty('--spot-x', `${e.clientX - r.left}px`)
                e.currentTarget.style.setProperty('--spot-y', `${e.clientY - r.top}px`)
              }}
              className="spotlight-card group relative rounded-2xl border border-border/60 bg-card p-7 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-white group-hover:shadow-glow">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const PLANS = [
  {
    name: 'Candidate',
    price: '$0',
    period: 'forever',
    description: 'For candidates who want to practice and get feedback.',
    features: ['1 free interview', 'Full AI report', 'Downloadable PDF', 'Strength & weakness analysis'],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Recruiter',
    price: '$49',
    period: '/month',
    description: 'For teams evaluating candidates at scale.',
    features: [
      'Unlimited interviews',
      'Admin dashboard',
      'Advanced analytics',
      'Custom job postings',
      'Priority processing',
      'Export & PDF reports',
    ],
    cta: 'Start with Recruiter',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For organizations with advanced needs.',
    features: ['Everything in Recruiter', 'SSO & SAML', 'Dedicated support', 'Custom AI models'],
    cta: 'Contact sales',
    highlight: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="section-padding border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            Pricing
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="mx-auto mt-3 h-1 w-20 origin-center rounded-full bg-gradient-to-r from-primary via-blue-400 to-primary"
          />
          <p className="mt-4 text-muted-foreground">Start free. Scale when you're ready.</p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className={`relative flex flex-col rounded-3xl p-8 transition-all duration-300 ${
                plan.highlight
                  ? 'animate-border-spin shadow-glow lg:-translate-y-3'
                  : 'border border-border/60 bg-card shadow-soft hover:-translate-y-1 hover:shadow-card'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-primary-dark px-4 py-1 text-xs font-bold text-white shadow-glow">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-lg font-bold text-foreground">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold text-foreground">{plan.price}</span>
                {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
              </div>
              <ul className="mt-7 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {feature}
                  </li>
                ))}
              </ul>
              <CTAButton
                to="/register"
                variant={plan.highlight ? 'primary' : 'outline'}
                className="mt-8 w-full"
              >
                {plan.cta}
              </CTAButton>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const FAQS = [
  {
    question: 'How does the AI evaluation work?',
    answer:
      'HireLens transcribes the interview, analyzes speech patterns and sentiment, then evaluates responses against the job description using AI. Every score is backed by evidence from the transcript.',
  },
  {
    question: 'What file formats are supported?',
    answer:
      'MP4, MOV, AVI, MKV for video and MP3, WAV, M4A, FLAC, AAC for audio — up to 200MB per recording.',
  },
  {
    question: 'How long does processing take?',
    answer:
      'Most interviews complete within a few minutes. You can close the page and return later — progress is tracked on the server.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. Recordings are stored securely, access is role-based, and only the recruiter you share with can see your results.',
  },
  {
    question: 'Can candidates see their results?',
    answer:
      'Yes. Candidates get a full report with scores, strengths, weaknesses and improvement suggestions.',
  },
]

export function FAQ() {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="section-padding">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            FAQ
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Frequently asked questions
          </h2>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="mx-auto mt-3 h-1 w-20 origin-center rounded-full bg-gradient-to-r from-primary via-blue-400 to-primary"
          />
        </div>

        <div className="mt-12 space-y-4">
          {FAQS.map((faq, i) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft"
            >
              <button
                onClick={() => setOpen(open === i ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left focus-ring"
                aria-expanded={open === i}
              >
                <span className="font-display text-base font-semibold text-foreground">{faq.question}</span>
                <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="shrink-0 text-muted-foreground">
                  <Plus className="h-5 w-5" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function CTA() {
  return (
    <section className="pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary-dark px-8 py-16 text-center shadow-glow sm:px-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 -top-20 h-64 w-64 animate-glow-pulse rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 h-72 w-72 animate-glow-pulse rounded-full bg-blue-300/20 blur-3xl [animation-delay:2s]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.06)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_60%,transparent_100%)]" />
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to hire with confidence?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-blue-100">
              Join the future of talent evaluation. Upload your first interview in minutes.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/register"
                className="animate-shine group inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-sm font-semibold text-primary shadow-lg transition-all hover:scale-[1.03] active:scale-[0.98]"
              >
                Get started free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/login"
                className="inline-flex h-12 items-center rounded-xl border border-white/30 px-7 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
