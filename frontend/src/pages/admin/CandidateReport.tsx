import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Card, ScoreRing, ScoreRadarChart, RecommendationPill, Button, LoadingSpinner,
} from '../../components/ui';
import type { RadarData } from '../../components/ui';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import {
  ArrowLeft, Download, Share2, ChevronDown, ChevronRight, Volume2,
} from 'lucide-react';
import type { CandidateDetail } from '../../types';

export function CandidateReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Technical Knowledge']));
  const [overrideLoading, setOverrideLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/admin/candidates/${id}`)
      .then(setDetail)
      .catch(() => navigate('/admin/dashboard'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <LoadingSpinner className="py-20" />;
  if (!detail) return null;

  const { candidate, job, evaluation } = detail;

  const radarData: RadarData[] = [
    { subject: 'Technical', score: evaluation?.technical_score ?? 0, fullMark: 100 },
    { subject: 'Communication', score: evaluation?.communication_score ?? 0, fullMark: 100 },
    { subject: 'Confidence', score: evaluation?.confidence_score ?? 0, fullMark: 100 },
    { subject: 'Problem Solving', score: evaluation?.problem_solving_score ?? 0, fullMark: 100 },
    { subject: 'Experience', score: evaluation?.experience_score ?? 0, fullMark: 100 },
  ];

  const tabs = ['Overview', 'Transcript', 'Evaluation Details', 'AI Insights'];

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleOverride = async (recommendation: string) => {
    if (!id) return;
    setOverrideLoading(true);
    try {
      await api.post(`/admin/candidates/${id}/recommendation`, { recommendation });
      toast({
        title: 'Recommendation updated',
        description: `Changed to "${recommendation}"`,
        type: 'success',
      });
      // Refresh detail
      const updated = await api.get(`/admin/candidates/${id}`);
      setDetail(updated);
    } catch (err: unknown) {
      toast({
        title: 'Failed to update',
        description: err instanceof Error ? err.message : 'Something went wrong',
        type: 'error',
      });
    } finally {
      setOverrideLoading(false);
    }
  };

  return (
    <div>
      {/* Back link */}
      <Link
        to="/admin/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[#4B5563] hover:text-[#111827] mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Candidates
      </Link>

      {/* Candidate header */}
      <Card className="mb-6">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center text-lg font-semibold text-gray-600 overflow-hidden shrink-0">
              {candidate.photo_url ? (
                <img src={candidate.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                candidate.full_name?.charAt(0) || '?'
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#111827]">{candidate.full_name}</h1>
              <p className="text-sm text-gray-500">{candidate.email}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className="text-sm font-medium text-gray-700">{job?.title}</span>
                <span className="text-gray-300">·</span>
                <span className="text-sm text-gray-500">{job?.company}</span>
                {detail.interview_date && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-sm text-gray-500">
                      {new Date(detail.interview_date).toLocaleDateString()}
                    </span>
                  </>
                )}
                {detail.interview_status && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${detail.interview_status === 'completed' ? 'bg-[#DCFCE7] text-[#16A34A]' : ''}
                      ${detail.interview_status === 'analyzing' || detail.interview_status === 'transcribing' ? 'bg-[#EFF6FF] text-[#2563EB]' : ''}
                    `}>
                      {detail.interview_status}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {detail.audio_url && (
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <Volume2 size={16} className="text-gray-500" />
                <audio controls className="h-8 w-40">
                  <source src={detail.audio_url} type="audio/wav" />
                </audio>
              </div>
            )}
            <Button variant="outline" className="!px-4">
              <Download size={16} className="mr-1.5" />
              Download Report
            </Button>
            <Button className="!px-4">
              <Share2 size={16} className="mr-1.5" />
              Share Report
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 inline-flex">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase().replace(' ', '-'))}
            className={`px-5 py-2.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.toLowerCase().replace(' ', '-')
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 3-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Col 1: Overall Score */}
            <Card className="flex flex-col items-center text-center">
              <ScoreRing score={evaluation?.overall_score ?? 0} size={160} strokeWidth={12} />
              {evaluation?.recommendation && (
                <div className="mt-3">
                  <RecommendationPill label={evaluation.recommendation} />
                </div>
              )}
              {evaluation?.ai_summary && (
                <p className="text-sm text-[#4B5563] mt-4 leading-relaxed text-left">
                  {evaluation.ai_summary}
                </p>
              )}

              {/* Admin override buttons */}
              {detail.interview_status === 'completed' && (
                <div className="mt-6 pt-4 border-t w-full" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">
                    Override Recommendation
                  </p>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Recommended', variant: 'green' as const },
                      { label: 'Need Further Review', variant: 'amber' as const },
                      { label: 'Not Recommended', variant: 'red' as const },
                    ].map(({ label, variant }) => {
                      const isActive = evaluation?.recommendation === label;
                      const colorMap = {
                        green: 'bg-[#DCFCE7] text-[#16A34A] border-[#22C55E]',
                        amber: 'bg-[#FEF3C7] text-[#D97706] border-[#F59E0B]',
                        red: 'bg-[#FEE2E2] text-[#DC2626] border-[#EF4444]',
                      };
                      return (
                        <button
                          key={label}
                          disabled={overrideLoading || isActive}
                          onClick={() => handleOverride(label)}
                          className={`text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
                            isActive
                              ? `${colorMap[variant]} cursor-default`
                              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>

            {/* Col 2: Score Breakdown */}
            <Card>
              <h2 className="text-sm font-semibold text-[#111827] uppercase tracking-wide mb-4">
                Score Breakdown
              </h2>
              <ScoreRadarChart data={radarData} />
            </Card>

            {/* Col 3: Strengths & Areas for Improvement */}
            <div className="space-y-6">
              {evaluation?.strengths && evaluation.strengths.length > 0 && (
                <Card>
                  <h2 className="text-sm font-semibold text-[#16A34A] uppercase tracking-wide mb-3">Strengths</h2>
                  <ul className="space-y-2">
                    {evaluation.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full mt-1.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {evaluation?.weaknesses && evaluation.weaknesses.length > 0 && (
                <Card>
                  <h2 className="text-sm font-semibold text-[#D97706] uppercase tracking-wide mb-3">
                    Areas for Improvement
                  </h2>
                  <ul className="space-y-2">
                    {evaluation.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full mt-1.5 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>

          {/* Evidence from Transcript */}
          {evaluation?.evidence && Object.keys(evaluation.evidence).length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-[#111827] uppercase tracking-wide mb-4">
                Evidence from Transcript
              </h2>
              <div className="space-y-3">
                {Object.entries(evaluation.evidence).map(([category, items]) => (
                  <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#111827] hover:bg-gray-50 transition-colors"
                    >
                      <span>{category}</span>
                      {expandedCategories.has(category) ? (
                        <ChevronDown size={16} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={16} className="text-gray-400" />
                      )}
                    </button>
                    {expandedCategories.has(category) && Array.isArray(items) && (
                      <div className="px-4 pb-3 space-y-2">
                        {items.map((item, i) => (
                          <div key={i} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm text-gray-700 italic">"{item.quote}"</p>
                            {item.timestamp && (
                              <p className="text-xs text-gray-400 mt-1">Timestamp: {item.timestamp}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Transcript tab */}
      {activeTab === 'transcript' && (
        <Card>
          <h2 className="text-sm font-semibold text-[#111827] uppercase tracking-wide mb-4">
            Refined Transcript
          </h2>
          {detail.transcript?.refined_transcript ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {detail.transcript.refined_transcript}
            </p>
          ) : detail.transcript?.raw_transcript ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {detail.transcript.raw_transcript}
            </p>
          ) : (
            <p className="text-sm text-gray-400">No transcript available.</p>
          )}
        </Card>
      )}

      {/* Evaluation Details tab */}
      {activeTab === 'evaluation-details' && (
        <Card>
          <h2 className="text-sm font-semibold text-[#111827] uppercase tracking-wide mb-4">
            Detailed Scores
          </h2>
          <div className="space-y-4">
            {[
              { label: 'Technical', score: evaluation?.technical_score },
              { label: 'Communication', score: evaluation?.communication_score },
              { label: 'Confidence', score: evaluation?.confidence_score },
              { label: 'Problem Solving', score: evaluation?.problem_solving_score },
              { label: 'Experience', score: evaluation?.experience_score },
            ].map(({ label, score }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700 font-medium">{label}</span>
                  <span className={`font-semibold ${(score ?? 0) >= 80 ? 'text-[#16A34A]' : (score ?? 0) >= 60 ? 'text-[#D97706]' : 'text-[#DC2626]'}`}>
                    {score != null ? `${Math.round(score)}/100` : '-'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#4F6EF7] h-2 rounded-full transition-all"
                    style={{ width: `${score ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AI Insights tab */}
      {activeTab === 'ai-insights' && (
        <div className="space-y-6">
          {evaluation?.strengths && evaluation.strengths.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-[#16A34A] uppercase tracking-wide mb-3">Strengths Analysis</h2>
              <ul className="space-y-3">
                {evaluation.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="w-6 h-6 bg-[#DCFCE7] rounded-full flex items-center justify-center text-xs font-bold text-[#16A34A] shrink-0">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {evaluation?.weaknesses && evaluation.weaknesses.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-[#D97706] uppercase tracking-wide mb-3">Development Areas</h2>
              <ul className="space-y-3">
                {evaluation.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="w-6 h-6 bg-[#FEF3C7] rounded-full flex items-center justify-center text-xs font-bold text-[#D97706] shrink-0">
                      {i + 1}
                    </span>
                    {w}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {evaluation?.evidence && (
            <Card>
              <h2 className="text-sm font-semibold text-[#111827] uppercase tracking-wide mb-3">Supporting Evidence</h2>
              <p className="text-sm text-gray-500">
                View the "Overview" tab for evidence quoted directly from the interview transcript, organized by category.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
