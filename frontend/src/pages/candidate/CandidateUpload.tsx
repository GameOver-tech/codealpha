import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { UploadCloud, FileVideo, X, AlertTriangle, CheckCircle2, Video } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Input, Label, Progress } from '@/components/ui'
import { PageHeader } from '@/components/shared'
import { adminApi, getErrorMessage } from '@/services/api'
import { formatBytes } from '@/lib/utils'

const ACCEPTED_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'm4a', 'flac', 'aac']
const MAX_SIZE = 200 * 1024 * 1024 // 200 MB

export function CandidateUploadPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [jobTitle, setJobTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const validateFile = useCallback((candidate: File): string | null => {
    const ext = candidate.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type ".${ext}". Allowed: ${ACCEPTED_EXTENSIONS.join(', ')}.`
    }
    if (candidate.size > MAX_SIZE) {
      return `File is too large (max 200MB). Your file is ${formatBytes(candidate.size)}.`
    }
    return null
  }, [])

  const onDrop = useCallback(
    (accepted: File[]) => {
      const candidate = accepted[0]
      if (!candidate) return
      const err = validateFile(candidate)
      if (err) {
        setError(err)
        toast.error(err)
        return
      }
      setError(null)
      setFile(candidate)
    },
    [validateFile],
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac', '.aac'],
    },
    maxFiles: 1,
    multiple: false,
    noClick: true,
  })

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setProgress(15)
    const timer = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 95) {
          window.clearInterval(timer)
          return p
        }
        return p + Math.random() * 8
      })
    }, 400)
    try {
      await adminApi.upload(file, jobTitle || 'Interview', '')
      window.clearInterval(timer)
      setProgress(100)
      toast.success('Upload successful! Processing started.')
      navigate(`/dashboard/processing`)
    } catch (uploadError) {
      window.clearInterval(timer)
      setProgress(0)
      toast.error(getErrorMessage(uploadError))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Upload Interview"
        description="Submit your recording — our AI will evaluate your performance."
      />

      <Card>
        <CardContent className="p-6 sm:p-8">
          <div
            {...getRootProps()}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all duration-300 ${
              isDragActive
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-primary/50 hover:bg-muted/40'
            }`}
          >
            <input {...getInputProps()} />
            <motion.div
              animate={{ y: isDragActive ? -6 : 0 }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-blue-400/15 text-primary"
            >
              <UploadCloud className="h-8 w-8" />
            </motion.div>
            <h3 className="mt-5 font-display text-lg font-bold text-foreground">
              {isDragActive ? 'Drop your recording here' : 'Drag & drop your recording here'}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              MP4, MOV, AVI, MKV, MP3, WAV, M4A, FLAC, AAC · up to 200MB
            </p>
            <Button variant="outline" className="mt-6" onClick={open} disabled={uploading}>
              Choose file
            </Button>
          </div>

          {file && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex items-center gap-4 rounded-xl border border-border/60 bg-muted/40 p-4"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileVideo className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              {error ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Invalid
                </span>
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              )}
              {!uploading && (
                <Button variant="ghost" size="icon" onClick={() => { setFile(null); setError(null) }} aria-label="Remove file">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </motion.div>
          )}

          {uploading && (
            <div className="mt-5">
              <Progress value={progress} className="h-2" indicatorClassName="bg-gradient-to-r from-primary to-blue-400" />
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Uploading… {Math.round(progress)}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="space-y-2">
            <Label htmlFor="job_title">Job title</Label>
            <Input
              id="job_title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
            />
          </div>
          <Button size="lg" className="w-full" onClick={handleUpload} disabled={!file || Boolean(error)} loading={uploading}>
            <UploadCloud />
            Submit interview
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Video className="h-3.5 w-3.5" />
            You can close this page — your progress is tracked automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
