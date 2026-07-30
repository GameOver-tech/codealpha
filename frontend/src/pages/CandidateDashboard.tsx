import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Button, ScoreRing, LoadingSpinner, Avatar, RecommendationPill } from '../components/ui';
import { Footer } from '../components/layout/Footer';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { BarChart3, Plus, Calendar, Clock, Edit2, X, Check } from 'lucide-react';

interface InterviewItem {
  id: string;
  job_title: string;
  job_company: string;
  status: string;
  overall_score?: number | null;
  recommendation?: string | null;
  interview_date: string;
}

function StatusBadge({ status, recommendation }: { status: string; recommendation?: string | null }) {
  if (status !== 'completed') {
    const labels: Record<string, string> = {
      uploaded: 'Uploaded',
      transcribing: 'Transcribing',
      analyzing: 'Analyzing',
    };
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#2563EB]">
        <Clock size={12} />
        {labels[status] || status}
      </span>
    );
  }

  if (!recommendation) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#FEF3C7] text-[#D97706]">
        Under Review
      </span>
    );
  }

  return <RecommendationPill label={recommendation} />;
}

export function CandidateDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/candidates/me/interviews')
      .then((data) => {
        setInterviews(data.interviews || []);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.put('/candidates/me/profile', { full_name: editName.trim() });
      toast({ title: 'Profile updated', type: 'success' });
      setEditing(false);
      // Refresh user data via re-verify
      const refreshed = await api.get('/auth/verify');
      if (refreshed) window.location.reload();
    } catch (err: unknown) {
      toast({
        title: 'Failed to update',
        description: err instanceof Error ? err.message : 'Something went wrong',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Simple navbar */}
      <nav className="flex items-center justify-between px-8 py-4" style={{ backgroundColor: 'var(--color-card)', borderBottom: '1px solid var(--color-border)' }}>
        <Link to="/" className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>HireLens AI</Link>
        <div className="flex items-center gap-4">
          <Avatar src={user?.photo_url} name={user?.full_name} size={32} />
          <button
            onClick={signOut}
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--color-body)' }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full">
        {/* Welcome header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-heading)' }}>
              Welcome back, {user?.full_name?.split(' ')[0] || 'there'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-body)' }}>
              Here's an overview of your interviews
            </p>
          </div>
          <Button onClick={() => navigate('/interview/new')}>
            <Plus size={18} className="mr-1.5" />
            New Interview
          </Button>
        </div>

        {/* Profile card */}
        <Card className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Avatar src={user?.photo_url} name={user?.full_name} size={56} />
            <div className="flex-1">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4F6EF7]"
                    style={{ color: 'var(--color-heading)', backgroundColor: 'var(--color-card)' }}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving || !editName.trim()}
                    className="p-1.5 rounded-lg text-[#22C55E] hover:bg-green-50 disabled:opacity-50"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="p-1.5 rounded-lg text-[#EF4444] hover:bg-red-50"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--color-heading)' }}>{user?.full_name}</h2>
                  <p className="text-sm" style={{ color: 'var(--color-body)' }}>{user?.email}</p>
                </>
              )}
            </div>
          </div>
          {!editing && (
            <button
              onClick={() => { setEditName(user?.full_name || ''); setEditing(true); }}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition-colors"
              style={{ color: 'var(--color-body)', borderColor: 'var(--color-border)' }}
            >
              <Edit2 size={14} />
              Edit
            </button>
          )}
        </Card>

        {/* Interview history */}
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-heading)' }}>
          Interview History
        </h2>

        {loading ? (
          <LoadingSpinner className="py-16" />
        ) : error ? (
          <Card className="text-center py-8">
            <p style={{ color: 'var(--color-body)' }}>Could not load interviews. Please try again later.</p>
          </Card>
        ) : interviews.length === 0 ? (
          <Card className="text-center py-12">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 size={32} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-heading)' }}>
              No interviews yet
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--color-body)' }}>
              Start your first interview to get AI-powered feedback
            </p>
            <Button onClick={() => navigate('/interview/new')}>
              <Plus size={18} className="mr-1.5" />
              Start Your First Interview
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {interviews.map((item) => (
              <Card
                key={item.id}
                className="flex items-center gap-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                onClick={() => {
                  if (item.status === 'completed') {
                    navigate(`/candidate/results/${item.id}`);
                  }
                }}
              >
                {/* Score */}
                <div className="shrink-0">
                  {item.overall_score != null ? (
                    <ScoreRing score={item.overall_score} size={64} strokeWidth={5} />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Clock size={24} style={{ color: 'var(--color-muted)' }} />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold" style={{ color: 'var(--color-heading)' }}>
                    {item.job_title}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--color-body)' }}>
                    {item.job_company}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <StatusBadge status={item.status} recommendation={item.recommendation} />
                    <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                      <Calendar size={12} className="inline mr-1" />
                      {new Date(item.interview_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
