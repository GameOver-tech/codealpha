import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, LoadingSpinner } from '../components/ui';
import { api } from '../lib/api';
import { Clock, Pause, Wifi } from 'lucide-react';
import type { Job } from '../types';

export function InterviewIntro() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;
    // If jobId is 'new', show job selection
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">No interviews available</h2>
          <p className="text-gray-500 mb-4">There are no active job postings to interview for right now.</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{job.title}</h1>
              <p className="text-gray-600">{job.company}</p>
              <div className="flex gap-2 mt-2">
                {job.location && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{job.location}</span>
                )}
                {job.employment_type && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{job.employment_type}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">About this role</h2>
            <p className="text-gray-600 text-sm leading-relaxed">{job.description}</p>
          </div>

          {job.expectations && job.expectations.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">What to expect</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Clock size={16} className="text-blue-600 shrink-0" />
                  Duration: Approximately 30-45 minutes
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Pause size={16} className="text-blue-600 shrink-0" />
                  You can pause and resume your recording
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Wifi size={16} className="text-blue-600 shrink-0" />
                  Ensure stable internet connection
                </div>
                {job.expectations.map((exp, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="w-2 h-2 bg-blue-600 rounded-full shrink-0" />
                    {exp}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Button
          fullWidth
          className="!py-4 text-lg"
          onClick={() => navigate(`/interview/${job.id}/upload`)}
        >
          Begin Interview
        </Button>
      </div>
    </div>
  );
}
