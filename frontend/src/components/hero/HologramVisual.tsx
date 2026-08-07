import { motion } from 'framer-motion'

/**
 * Premium floating glass presentation for the AI brain illustration.
 * Keeps the exact same brain image, but frames it so it blends into both
 * light and dark themes: soft mask, layered glass, theme-adaptive glows,
 * reflections and slow ambient particles.
 */
export function HologramVisual() {
  return (
    <div className="relative w-full">
      {/* ---- Theme-adaptive ambient glow behind the glass ---- */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[42px] bg-[radial-gradient(60%_55%_at_50%_42%,rgba(59,130,246,0.28),transparent_70%)] blur-2xl dark:bg-[radial-gradient(60%_55%_at_50%_42%,rgba(59,130,246,0.5),transparent_72%)]"
      />
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-full bg-[radial-gradient(45%_40%_at_30%_20%,rgba(34,211,238,0.16),transparent_70%)] blur-3xl dark:bg-[radial-gradient(45%_40%_at_30%_20%,rgba(34,211,238,0.28),transparent_70%)]"
      />
      {/* Soft reflection beneath the platform */}
      <div
        aria-hidden
        className="absolute -bottom-10 left-1/2 -z-10 h-16 w-3/5 -translate-x-1/2 rounded-[100%] bg-[radial-gradient(50%_100%_at_50%_50%,rgba(59,130,246,0.35),transparent_75%)] blur-2xl dark:bg-[radial-gradient(50%_100%_at_50%_50%,rgba(96,165,250,0.5),transparent_75%)]"
      />

      {/* ---- Floating glass container ---- */}
      <div className="animate-float-soft">
        <div className="relative overflow-hidden rounded-[32px] border border-white/50 bg-white/40 shadow-[0_24px_70px_-24px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_30px_90px_-30px_rgba(37,99,235,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]">
          {/* Top sheen */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/45 via-white/10 to-transparent dark:from-white/10 dark:via-white/[0.03] dark:to-transparent"
          />
          {/* Inner glass tint */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgba(147,197,253,0.18),transparent_65%)] dark:bg-[radial-gradient(70%_50%_at_50%_0%,rgba(59,130,246,0.12),transparent_65%)]"
          />

          {/* The brain illustration — same image, softly blended into the frame */}
          <div className="relative mx-auto aspect-[4/3.6] w-full overflow-hidden">
            <img
              src="/ai-brain.jpg"
              alt="AI holographic brain"
              width={1200}
              height={939}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover"
            />
            {/* Blend the dark image into the page background (both themes) */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(75%_70%_at_50%_45%,transparent_42%,rgb(255_255_255/0.92)_78%,rgb(255_255_255/1)_100%)] dark:bg-[radial-gradient(75%_70%_at_50%_45%,transparent_42%,rgb(15_23_42/0.9)_78%,rgb(15_23_42/0.98)_100%)]"
            />
            {/* Neon edge highlight */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[32px] shadow-[inset_0_0_0_1px_rgba(96,165,250,0.18),inset_0_0_40px_rgba(59,130,246,0.08)]"
            />
          </div>
        </div>
      </div>

      {/* ---- Floating candidate cards (closer to the brain, above the glass) ---- */}
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-2 top-[16%] hidden rounded-2xl border border-white/60 bg-white/80 px-3.5 py-2.5 shadow-[0_12px_32px_-12px_rgba(37,99,235,0.45)] backdrop-blur-xl dark:border-white/15 dark:bg-slate-900/70 dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)] sm:block"
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">AI Recruitment</p>
        <p className="mt-0.5 text-xs font-extrabold text-foreground">EMP</p>
        <p className="text-[10px] text-muted-foreground">Empowering Careers</p>
      </motion.div>
      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -right-2 top-[34%] hidden rounded-2xl border border-white/60 bg-white/80 px-3.5 py-2.5 shadow-[0_12px_32px_-12px_rgba(37,99,235,0.45)] backdrop-blur-xl dark:border-white/15 dark:bg-slate-900/70 dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)] sm:block"
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">AI Candidate</p>
        <p className="mt-0.5 text-xs font-extrabold text-foreground">EMP</p>
        <p className="text-[10px] text-muted-foreground">Future Professionals</p>
      </motion.div>

      {/* ---- Scanline sweeping over the illustration ---- */}
      <div className="pointer-events-none absolute inset-x-6 top-0 h-24 animate-scanline rounded-full bg-gradient-to-b from-transparent via-blue-400/10 to-transparent" />

      {/* ---- Slow ambient glowing particles ---- */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute left-[12%] top-[22%] h-1.5 w-1.5 animate-particle-slow rounded-full bg-blue-400/70 shadow-[0_0_10px_rgba(59,130,246,0.9)]" />
        <span
          className="absolute right-[16%] top-[30%] h-1 w-1 animate-particle-slow rounded-full bg-cyan-300/70 shadow-[0_0_8px_rgba(103,232,249,0.9)]"
          style={{ animationDelay: '3.2s' }}
        />
        <span
          className="absolute bottom-[26%] left-[20%] h-2 w-2 animate-particle-slow rounded-full bg-indigo-300/60 shadow-[0_0_10px_rgba(165,180,252,0.9)]"
          style={{ animationDelay: '6.4s' }}
        />
        <span
          className="absolute right-[24%] top-[58%] h-1.5 w-1.5 animate-particle-slow rounded-full bg-blue-300/70 shadow-[0_0_10px_rgba(96,165,250,0.9)]"
          style={{ animationDelay: '1.6s' }}
        />
        <span
          className="absolute left-[28%] bottom-[16%] h-1 w-1 animate-particle-slow rounded-full bg-cyan-300/60 shadow-[0_0_8px_rgba(103,232,249,0.8)]"
          style={{ animationDelay: '4.8s' }}
        />
        <span
          className="absolute right-[34%] top-[12%] h-1 w-1 animate-particle-slow rounded-full bg-blue-400/60 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
          style={{ animationDelay: '8s' }}
        />
      </div>
    </div>
  )
}
