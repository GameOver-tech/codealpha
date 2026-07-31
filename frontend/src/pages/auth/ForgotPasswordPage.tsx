import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowLeft } from 'lucide-react'
import { AuthLayout } from '@/layouts/AuthLayout'
import { Button, Input, Label } from '@/components/ui'

const forgotSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) })

  const onSubmit = async (values: ForgotForm) => {
    setSubmitting(true)
    // Simulate the password-reset request. No backend endpoint exists yet,
    // so we guide the user to contact support.
    await new Promise((resolve) => setTimeout(resolve, 600))
    setSubmitting(false)
    setEmail(values.email)
    setSent(true)
  }

  return (
    <AuthLayout>
      {sent ? (
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10">
            <Mail className="h-8 w-8 text-success" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-foreground">Check your email</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Password reset is not available self-service yet. Please contact your recruiter or
            administrator at <span className="font-semibold text-foreground">{email}</span> to reset your password.
          </p>
          <Button asChild variant="outline" className="mt-8">
            <Link to="/login">
              <ArrowLeft />
              Back to sign in
            </Link>
          </Button>
        </div>
      ) : (
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Forgot password?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email and we&apos;ll guide you through the next steps.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email && <p className="text-xs font-medium text-destructive">{errors.email.message}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" loading={submitting}>
              Send reset instructions
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  )
}
