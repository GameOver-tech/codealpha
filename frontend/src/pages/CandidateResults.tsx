import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Card, ScoreRing, ScoreRadarChart, RecommendationPill, Button, LoadingSpinner,
} from '../components/ui';
import type { RadarData } from '../components/ui';
import { Footer } from '../components/layout/Footer';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/ui';
import { ArrowLeft, Calendar } from 'lucide-react';

interface CandidateResult {
  candidate: { full_name: string; email: string; photo_url?: string };
  job: { title: string; company: string } | null;
  interview_status: string | null;
  interview_date: string | null;
  evaluation: {
    technical_score?: number | null;
    communication_score?: number | null;
    confidence_score?: number | null;
    problem_solving_score?: number | null;
    experience_score?: number | null;
    overall_score?: number | null;
    recommendation?: string | null;
    strengths?: string[] | null;
    weaknesses?: string[] | null;
    ai_summary?: string | null;
  } | null;
}

export function CandidateResults() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [result, setResult] = useState<CandidateResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!interviewId || !user) return;
    api.get(`/admin/candidates/${user.id}`)
      .then((data) => setResult(data))
      .catch(() => navigate('/candidate/dashboard'))
      .finally(() => setLoading(false));
  }, [interviewId, user, navigate]);

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!result) return null;

  const { evaluation } = result;

  const radarData: RadarData[] = [
    { subject: 'Technical', score: evaluation?.technical_score ?? 0, fullMark: 100 },
    { subject: 'Communication', score: evaluation?.communication_score ?? 0, fullMark: 100 },
    { subject: 'Confidence', score: evaluation?.confidence_score ?? 0, fullMark: 100 },
    { subject: 'Problem Solving', score: evaluation?.problem_solving_score ?? 0, fullMark: 100 },
    { subject: 'Experience', score: evaluation?.experience_score ?? 0, fullMark: 100 },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Simple navbar */}
      <nav className="flex items-center justify-between px-8 py-4" style={{ backgroundColor: 'var(--color-card)', borderBottom: '1px solid var(--color-border)' }}>
        <Link to="/" className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>HireLens AI</Link>
        <div className="flex items-center gap-4">
          <Avatar src={user?.photo_url} name={user?.full_name} size={32} />
          <Link
            to="/candidate/dashboard"
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--color-body)' }}
          >
            Dashboard
          </Link>
        </div>
      </nav>

      <div className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full">
        <Link
          to="/candidate/dashboard"
          className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
          style={{ color: 'var(--color-body)' }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        {/* Header */}
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <Avatar src={user?.photo_url} name={user?.full_name} size={48} />
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--color-heading)' }}>{result.candidate.full_name}</h1>
              <p className="text-sm" style={{ color: 'var(--color-body)' }}>{result.job?.title} · {result.job?.company}</p>
              {result.interview_date && (
                <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  <Calendar size={12} className="inline mr-1" />
                  {new Date(result.interview_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Score Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="flex flex-col items-center text-center">
            <ScoreRing score={evaluation?.overall_score ?? 0} size={160} strokeWidth={12} />
            {evaluation?.recommendation && (
              <div className="mt-3">
                <RecommendationPill label={evaluation.recommendation} />
              </div>
            )}
            {evaluation?.ai_summary && (
              <p className="text-sm mt-4 leading-relaxed text-left" style={{ color: 'var(--color-body)' }}>
                {evaluation.ai_summary}
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--color-heading)' }}>
              Score Breakdown
            </h2>
            <ScoreRadarChart data={radarData} />
          </Card>

          <div className="space-y-6">
            {evaluation?.strengths && evaluation.strengths.length > 0 && (
              <Card>
                <h2 className="text-sm font-semibold text-[#16A34A] uppercase tracking-wide mb-3">Your Strengths</h2>
                <ul className="space-y-2">
                  {evaluation.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-body)' }}>
                      <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full mt-1.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {evaluation?.weaknesses && evaluation.weaknesses.length > 0 && (
              <Card>
                <h2 className="text-sm font-semibold text-[#D97706] uppercase tracking-wide mb-3">Areas to Improve</h2>
                <ul className="space-y-2">
                  {evaluation.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-body)' }}>
                      <span className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full mt-1.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>

        <div className="text-center">
          <Button onClick={() => navigate('/candidate/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
