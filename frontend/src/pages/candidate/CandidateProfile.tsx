import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Camera, Save, Building2, GraduationCap, Wrench, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Input, Label, Skeleton, Textarea } from '@/components/ui'
import { Avatar, AvatarFallback, AvatarImage, PageHeader, CardSection } from '@/components/shared'
import { useAuth } from '@/context'
import { useProfile, queryKeys } from '@/hooks'
import { profileApi, mediaUrl, getErrorMessage } from '@/services/api'
import { initials } from '@/lib/utils'

const profileSchema = z.object({
  experience: z.string().optional(),
  skills: z.string().optional(),
  education: z.string().optional(),
  current_company: z.string().optional(),
  expected_salary: z.string().optional(),
})

type ProfileForm = z.infer<typeof profileSchema>

export function CandidateProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useProfile()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) })

  const updateMutation = useMutation({
    mutationFn: profileApi.update,
    onSuccess: (res) => {
      queryClient.setQueryData(queryKeys.profile, res.data)
      toast.success('Profile updated successfully')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const handlePicture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPEG, PNG and WebP images are allowed')
      return
    }
    setUploading(true)
    try {
      const res = await profileApi.uploadPicture(file)
      queryClient.setQueryData(queryKeys.profile, res.data)
      toast.success('Profile picture updated')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const onReset = () => {
    if (profile) reset(profile)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >
      <PageHeader
        title="Profile"
        description="Manage your personal and professional information."
        actions={
          <Button variant="outline" onClick={onReset}>
            Discard changes
          </Button>
        }
      />

      {/* Identity card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <Card className="overflow-hidden">
          <div className="h-28 bg-gradient-to-r from-primary via-blue-500 to-blue-400" />
          <CardContent className="-mt-12 pb-6">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-card shadow-card">
                  <AvatarImage
                    src={mediaUrl(profile?.profile_picture_url)}
                    alt={user?.full_name ?? ''}
                  />
                  <AvatarFallback className="text-2xl">{initials(user?.full_name ?? 'U')}</AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-4 border-card bg-primary text-white shadow-card transition-colors hover:bg-primary-dark disabled:opacity-60"
                  aria-label="Change profile picture"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePicture}
                />
              </div>
              <div className="text-center sm:pb-1 sm:text-left">
                <h2 className="font-display text-2xl font-bold text-foreground">{user?.full_name}</h2>
                <p className="text-sm text-muted-foreground">
                  {user?.email}
                  {user?.phone && ` · ${user.phone}`}
                </p>
                {profile?.current_company && (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Building2 className="h-3.5 w-3.5" />
                    {profile.current_company}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.form
        onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
        className="space-y-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <CardSection title="Professional information" description="Tell recruiters about your background.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="experience">Experience</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="experience"
                  className="pl-9"
                  placeholder="e.g. 5 years of full-stack development at SaaS companies…"
                  defaultValue={profile?.experience}
                  aria-invalid={Boolean(errors.experience)}
                  {...register('experience')}
                />
              </div>
              {errors.experience && <p className="text-xs font-medium text-destructive">{errors.experience.message}</p>}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="skills">Skills</Label>
              <div className="relative">
                <Wrench className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="skills"
                  className="pl-9"
                  placeholder="e.g. React, TypeScript, Node.js, AWS…"
                  defaultValue={profile?.skills}
                  aria-invalid={Boolean(errors.skills)}
                  {...register('skills')}
                />
              </div>
              {errors.skills && <p className="text-xs font-medium text-destructive">{errors.skills.message}</p>}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="education">Education</Label>
              <div className="relative">
                <GraduationCap className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="education"
                  className="pl-9"
                  placeholder="e.g. B.Sc. Computer Science, University of Example (2015–2019)"
                  defaultValue={profile?.education}
                  aria-invalid={Boolean(errors.education)}
                  {...register('education')}
                />
              </div>
              {errors.education && <p className="text-xs font-medium text-destructive">{errors.education.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="current_company">Current company</Label>
              <Input
                id="current_company"
                placeholder="e.g. Acme Corp"
                defaultValue={profile?.current_company}
                {...register('current_company')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_salary">Expected salary</Label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="expected_salary"
                  className="pl-9"
                  placeholder="e.g. $120,000"
                  defaultValue={profile?.expected_salary}
                  {...register('expected_salary')}
                />
              </div>
            </div>
          </div>
        </CardSection>

        <div className="flex justify-end gap-3">
          {isLoading && <Skeleton className="h-10 w-40" />}
          <Button type="submit" loading={updateMutation.isPending}>
            <Save />
            Save changes
          </Button>
        </div>
      </motion.form>
    </motion.div>
  )
}
