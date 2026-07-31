import { motion } from 'framer-motion'
import { ScanEye } from 'lucide-react'

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark shadow-glow"
      >
        <ScanEye className="h-8 w-8 text-white" />
      </motion.div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0.3s]" />
      </div>
    </div>
  )
}
