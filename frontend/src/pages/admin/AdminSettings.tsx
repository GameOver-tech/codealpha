import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, ShieldCheck, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Input, Label, Textarea } from '@/components/ui'
import { CardSection, PageHeader } from '@/components/shared'
import { authApi, getErrorMessage, jobsApi } from '@/services/api'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks'

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(8, 'New password must be at least 8 characters').max(128),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type PasswordForm = z.infer<typeof passwordSchema>

const jobSchema = z.object({
  title: z.string().min(1, 'Job title is required').max(255),
  description: z.string().max(5000).optional(),
})

type JobForm = z.infer<typeof jobSchema>

export function AdminSettings() {
  const queryClient = useQueryClient()

  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })
  const jobForm = useForm<JobForm>({ resolver: zodResolver(jobSchema) })

  const changePasswordMutation = useMutation({
    mutationFn: (values: PasswordForm) =>
      authApi.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      }),
    onSuccess: () => {
      toast.success('Password updated successfully')
      passwordForm.reset()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const createJobMutation = useMutation({
    mutationFn: (values: JobForm) =>
      jobsApi.create({ title: values.title, description: values.description ?? '' }),
    onSuccess: () => {
      toast.success('Job created')
      jobForm.reset()
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your admin account and job postings." />

      <CardSection title="Post a job" description="Create a new job posting for candidates to apply to.">
        <form onSubmit={jobForm.handleSubmit((values) => createJobMutation.mutate(values))} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="job-title">Job title</Label>
            <Input
              id="job-title"
              placeholder="e.g. Senior Frontend Engineer"
              aria-invalid={Boolean(jobForm.formState.errors.title)}
              {...jobForm.register('title')}
            />
            {jobForm.formState.errors.title && (
              <p className="text-xs font-medium text-destructive">{jobForm.formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-description">Description</Label>
            <Textarea
              id="job-description"
              rows={4}
              placeholder="Describe the role, responsibilities and ideal candidate…"
              {...jobForm.register('description')}
            />
          </div>
          <Button type="submit" loading={createJobMutation.isPending}>
            <Plus />
            Create job
          </Button>
        </form>
      </CardSection>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h3 className="font-display text-base font-bold text-foreground">Change password</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Use a strong password with at least 8 characters.
              </p>
            </div>
          </div>

          <form
            onSubmit={passwordForm.handleSubmit((values) => changePasswordMutation.mutate(values))}
            className="mt-6 max-w-md space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="current_password">Current password</Label>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(passwordForm.formState.errors.current_password)}
                {...passwordForm.register('current_password')}
              />
              {passwordForm.formState.errors.current_password && (
                <p className="text-xs font-medium text-destructive">
                  {passwordForm.formState.errors.current_password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">New password</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(passwordForm.formState.errors.new_password)}
                {...passwordForm.register('new_password')}
              />
              {passwordForm.formState.errors.new_password && (
                <p className="text-xs font-medium text-destructive">
                  {passwordForm.formState.errors.new_password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm new password</Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(passwordForm.formState.errors.confirm_password)}
                {...passwordForm.register('confirm_password')}
              />
              {passwordForm.formState.errors.confirm_password && (
                <p className="text-xs font-medium text-destructive">
                  {passwordForm.formState.errors.confirm_password.message}
                </p>
              )}
            </div>
            <Button type="submit" loading={changePasswordMutation.isPending}>
              <ShieldCheck />
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
