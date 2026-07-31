import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, FileQuestion, WifiOff, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui'

interface ErrorPageProps {
  code: number
  title: string
  description: string
  icon: typeof FileQuestion
}

function ErrorPage({ code, title, description, icon: Icon }: ErrorPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center"
      >
        <p className="font-display text-8xl font-extrabold text-gradient">{code}</p>
        <span className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-7 w-7" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        <Button asChild className="mt-8">
          <Link to="/">
            <Home />
            Back to home
          </Link>
        </Button>
      </motion.div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <ErrorPage
      code={404}
      title="Page not found"
      description="The page you're looking for doesn't exist or has been moved."
      icon={FileQuestion}
    />
  )
}

export function NetworkErrorPage() {
  return (
    <ErrorPage
      code={503}
      title="Network error"
      description="Cannot reach the HireLens backend. Make sure the API server is running at http://localhost:8000."
      icon={WifiOff}
    />
  )
}

export function ForbiddenPage() {
  return (
    <ErrorPage
      code={403}
      title="Access denied"
      description="You don't have permission to view this page."
      icon={ShieldAlert}
    />
  )
}

export function ServerErrorPage() {
  return (
    <ErrorPage
      code={500}
      title="Something went wrong"
      description="An unexpected error occurred. Please try again."
      icon={ShieldAlert}
    />
  )
}
