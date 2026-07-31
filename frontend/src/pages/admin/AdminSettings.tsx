import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, ShieldCheck, Bell, Palette, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Input, Label, Switch } from '@/components/ui'
import { PageHeader } from '@/components/shared'
import { authApi, getErrorMessage } from '@/services/api'
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

const SETTINGS_CATEGORIES = [
  {
    id: 'general',
    label: 'General',
    description: 'Account, profile and workspace preferences.',
    icon: KeyRound,
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Password and sign-in security.',
    icon: ShieldCheck,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Email and platform notifications.',
    icon: Bell,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Theme and display preferences.',
    icon: Palette,
  },
]

export function AdminSettings() {
  const [notifications, setNotifications] = useState(true)
  const [securityAlerts, setSecurityAlerts] = useState(true)

  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

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

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your admin account and workspace preferences." />

      {/* Settings categories */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SETTINGS_CATEGORIES.map((cat) => (
          <Card key={cat.id} className="card-hover">
            <CardContent className="p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <cat.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-display text-sm font-bold text-foreground">{cat.label}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{cat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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

      {/* Notifications */}
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h3 className="font-display text-base font-bold text-foreground">Notifications</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Choose what updates you want to receive.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Email notifications</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Receive an email when a report is ready.
                </p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} aria-label="Toggle email notifications" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Security alerts</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Get notified about sign-ins and password changes.
                </p>
              </div>
              <Switch checked={securityAlerts} onCheckedChange={setSecurityAlerts} aria-label="Toggle security alerts" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h3 className="font-display text-base font-bold text-destructive">Danger zone</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Irreversible account actions. Proceed with caution.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Deactivate account</p>
              <p className="text-xs text-muted-foreground">Temporarily disable your admin access.</p>
            </div>
            <Button variant="outline" className="text-destructive hover:text-destructive">
              Deactivate
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
