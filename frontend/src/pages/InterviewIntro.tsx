import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Button, LoadingSpinner } from '../components/ui';
import { api } from '../lib/api';
import { ArrowLeft, CheckCircle, Monitor, Briefcase } from 'lucide-react';
import type { Job } from '../types';

export function InterviewIntro() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;
    if (jobId === 'new') {
      api.get('/jobs').then((data) => {
        const jobs = data.jobs || [];
        if (jobs.length > 0) {
          navigate(`/interview/${jobs[0].id}`, { replace: true });
        }
        setLoading(false);
      }).catch(() => setLoading(false));
      return;
    }

    api.get(`/jobs/${jobId}`)
      .then((data) => {
        setJob(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [jobId, navigate]);

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <Card className="text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Briefcase size={28} className="text-gray-400" />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-heading)' }}>No interviews available</h2>
          <p className="mb-4" style={{ color: 'var(--color-body)' }}>There are no active job postings to interview for right now.</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </Card>
      </div>
    );
  }

  const expectations = [
    { text: 'Duration: Approximately 30-45 minutes', icon: CheckCircle },
    { text: 'Be honest and authentic in your responses', icon: CheckCircle },
    { text: 'You can pause and resume your recording', icon: CheckCircle },
    { text: 'Ensure stable internet connection', icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-5xl mx-auto">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
          style={{ color: 'var(--color-body)' }}
        >
          <ArrowLeft size={16} />
          Back to jobs
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left column — job details */}
          <div className="lg:col-span-3">
            <Card>
              <div className="mb-6">
                <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-heading)' }}>{job.title}</h1>
                <p style={{ color: 'var(--color-body)' }}>{job.company}</p>
                <div className="flex gap-2 mt-2">
                  {job.location && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">{job.location}</span>
                  )}
                  {job.employment_type && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">{job.employment_type}</span>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-heading)' }}>About this role</h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-body)' }}>{job.description}</p>
              </div>

              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-heading)' }}>What to expect</h2>
                <div className="space-y-3">
                  {expectations.map((exp, i) => {
                    const Icon = exp.icon;
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-body)' }}>
                        <Icon size={18} className="text-[#22C55E] shrink-0" />
                        {exp.text}
                      </div>
                    );
                  })}
                  {job.expectations?.map((exp, i) => (
                    <div key={`ext-${i}`} className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-body)' }}>
                      <CheckCircle size={18} className="text-[#22C55E] shrink-0" />
                      {exp}
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Button
              fullWidth
              className="!py-4 text-lg mt-6"
              onClick={() => navigate(`/interview/${job.id}/upload`)}
            >
              Begin Interview →
            </Button>
          </div>

          {/* Right column — illustration */}
          <div className="lg:col-span-2 hidden lg:block">
            <Card className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4">
                <Monitor size={48} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className="w-full max-w-[200px] h-24 rounded-lg border p-3 mb-3" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                <div className="flex gap-1 mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 bg-blue-100 dark:bg-blue-900/40 rounded w-full" />
                  <div className="h-2 bg-blue-100 dark:bg-blue-900/40 rounded w-3/4" />
                  <div className="h-2 bg-blue-100 dark:bg-blue-900/40 rounded w-5/6" />
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Your interview will be analyzed by AI
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
