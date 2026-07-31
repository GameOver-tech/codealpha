import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, ShieldCheck, Bell, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Input, Label, Switch } from '@/components/ui'
import { authApi, getErrorMessage } from '@/services/api'
import { useAuth } from '@/context'
import { useState } from 'react'

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

const personalSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().max(30, 'Phone number is too long').optional().or(z.literal('')),
  gender: z.string().max(30).optional().or(z.literal('')),
})

type PersonalForm = z.infer<typeof personalSchema>

export function CandidateSettings() {
  const { user, refreshUser } = useAuth()
  const [notifications, setNotifications] = useState(true)

  const personalForm = useForm<PersonalForm>({
    resolver: zodResolver(personalSchema),
    values: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      phone: user?.phone ?? '',
      gender: user?.gender ?? '',
    },
  })

  const updatePersonalMutation = useMutation({
    mutationFn: (values: PersonalForm) => authApi.updateMe(values),
    onSuccess: async () => {
      await refreshUser()
      toast.success('Personal information updated successfully')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const changePasswordMutation = useMutation({
    mutationFn: (values: PasswordForm) =>
      authApi.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      }),
    onSuccess: () => {
      toast.success('Password updated successfully')
      reset()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Settings</h1>

      {/* Personal information */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h3 className="font-display text-base font-bold text-foreground">Personal information</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Your name, phone number and gender.
              </p>
            </div>
          </div>

          <form
            onSubmit={personalForm.handleSubmit((values) => updatePersonalMutation.mutate(values))}
            className="mt-6 grid max-w-2xl gap-4 sm:grid-cols-2"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="candidate_first_name">First name</Label>
              <Input
                id="candidate_first_name"
                aria-invalid={Boolean(personalForm.formState.errors.first_name)}
                {...personalForm.register('first_name')}
              />
              {personalForm.formState.errors.first_name && (
                <p className="text-xs font-medium text-destructive">
                  {personalForm.formState.errors.first_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="candidate_last_name">Last name</Label>
              <Input
                id="candidate_last_name"
                aria-invalid={Boolean(personalForm.formState.errors.last_name)}
                {...personalForm.register('last_name')}
              />
              {personalForm.formState.errors.last_name && (
                <p className="text-xs font-medium text-destructive">
                  {personalForm.formState.errors.last_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="candidate_phone">Phone</Label>
              <Input
                id="candidate_phone"
                placeholder="e.g. +92 300 1234567"
                aria-invalid={Boolean(personalForm.formState.errors.phone)}
                {...personalForm.register('phone')}
              />
              {personalForm.formState.errors.phone && (
                <p className="text-xs font-medium text-destructive">
                  {personalForm.formState.errors.phone.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="candidate_gender">Gender</Label>
              <Input
                id="candidate_gender"
                placeholder="e.g. Male / Female / Other"
                aria-invalid={Boolean(personalForm.formState.errors.gender)}
                {...personalForm.register('gender')}
              />
              {personalForm.formState.errors.gender && (
                <p className="text-xs font-medium text-destructive">
                  {personalForm.formState.errors.gender.message}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" loading={updatePersonalMutation.isPending}>
                <UserRound />
                Save personal information
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h3 className="font-display text-base font-bold text-foreground">Email notifications</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Receive an email when your interview report is ready.
              </p>
            </div>
            <Switch checked={notifications} onCheckedChange={setNotifications} aria-label="Toggle notifications" />
          </div>
        </CardContent>
      </Card>

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

          <form onSubmit={handleSubmit((values) => changePasswordMutation.mutate(values))} className="mt-6 max-w-md space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="current_password">Current password</Label>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.current_password)}
                {...register('current_password')}
              />
              {errors.current_password && (
                <p className="text-xs font-medium text-destructive">{errors.current_password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">New password</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.new_password)}
                {...register('new_password')}
              />
              {errors.new_password && (
                <p className="text-xs font-medium text-destructive">{errors.new_password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm new password</Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirm_password)}
                {...register('confirm_password')}
              />
              {errors.confirm_password && (
                <p className="text-xs font-medium text-destructive">{errors.confirm_password.message}</p>
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
