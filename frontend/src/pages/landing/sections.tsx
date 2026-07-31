import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts'
import { ArrowRight, BadgeCheck, PlayCircle, Sparkles, Upload, FileText, Brain, LineChart, Trophy, Plus } from 'lucide-react'
import { CTAButton } from '@/components/shared'
import { CircularProgress } from '@/components/shared'

const HERO_RADAR = [
  { axis: 'Technical', score: 92 },
  { axis: 'Communication', score: 85 },
  { axis: 'Problem Solving', score: 82 },
  { axis: 'Confidence', score: 80 },
  { axis: 'Experience', score: 88 },
]

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-32 md:pb-32 md:pt-40">
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
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Your AI-powered <span className="text-gradient">talent evaluation</span> partner
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            Upload interview recordings and get deep, data-driven insights — speech analysis,
            sentiment detection, skill scoring, and hiring recommendations in minutes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center gap-4"
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
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
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
        </div>

        {/* Hero visual: animated score card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="glass-strong animate-float rounded-3xl p-8 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Interview Score</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Senior Software Engineer</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                <Trophy className="h-3.5 w-3.5" />
                Recommended
              </span>
            </div>

            <div className="mt-6 flex items-center justify-center">
              <CircularProgress value={87} size={180} label="Overall" />
            </div>

            <div className="mt-6 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={HERO_RADAR} outerRadius="78%">
                  <PolarGrid stroke="currentColor" className="text-slate-300 dark:text-slate-600" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke="#2563EB" fill="#2563EB" fillOpacity={0.35} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Technical</p>
                <p className="mt-0.5 font-display text-lg font-bold text-foreground">92/100</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Communication</p>
                <p className="mt-0.5 font-display text-lg font-bold text-foreground">85/100</p>
              </div>
            </div>
          </div>

          {/* Floating chips */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="absolute -left-6 -top-6 hidden rounded-2xl glass-strong px-4 py-3 shadow-card sm:block"
          >
            <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Upload className="h-4 w-4 text-primary" /> Upload
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="absolute -bottom-6 -right-4 hidden rounded-2xl glass-strong px-4 py-3 shadow-card sm:block"
          >
            <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Brain className="h-4 w-4 text-primary" /> AI Analysis
            </p>
          </motion.div>
        </motion.div>
      </div>
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
          <p className="mt-4 text-muted-foreground">
            A fully automated pipeline that turns raw interview recordings into actionable hiring intelligence.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="group relative rounded-2xl border border-border/60 bg-card p-6 text-center shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-card"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-blue-400/10 text-primary transition-colors group-hover:from-primary group-hover:to-primary-dark group-hover:text-white">
                <step.icon className="h-7 w-7" />
              </div>
              <span className="absolute right-4 top-4 text-xs font-bold text-muted-foreground/50">0{i + 1}</span>
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
              className="group rounded-2xl border border-border/60 bg-card p-7 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-white">
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
                  ? 'border-2 border-primary bg-card shadow-glow lg:-translate-y-3'
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
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />
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
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-sm font-semibold text-primary shadow-lg transition-all hover:scale-[1.03] active:scale-[0.98]"
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
