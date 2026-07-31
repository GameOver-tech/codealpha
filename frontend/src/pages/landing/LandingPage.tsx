import { motion } from 'framer-motion'
import { Navbar, Footer } from '@/components/shared'
import { Hero, HowItWorks, Features, Pricing, FAQ, CTA } from './sections'

export default function LandingPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background"
    >
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </motion.div>
  )
}
