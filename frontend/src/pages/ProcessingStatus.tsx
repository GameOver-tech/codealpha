import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui';
import { ScoreRing } from '../components/ui';
import { useInterviewStatus } from '../hooks/useInterviewStatus';
import { CheckCircle, Loader2, Circle } from 'lucide-react';

const stages = [
  { key: 'uploaded', label: 'Uploaded', desc: 'File received successfully' },
  { key: 'transcribing', label: 'Transcribing Audio', desc: 'Converting speech to text' },
  { key: 'analyzing', label: 'Analyzing Responses', desc: 'Running AI evaluation' },
  { key: 'completed', label: 'Generating Report', desc: 'Preparing your results' },
] as const;

const stageOrder = ['uploaded', 'transcribing', 'analyzing', 'completed'];

function StageIcon({ stageKey, currentStatus }: { stageKey: string; currentStatus: string }) {
  const stageIdx = stageOrder.indexOf(stageKey);
  const currentIdx = stageOrder.indexOf(currentStatus);

  if (currentIdx > stageIdx) {
    return <CheckCircle className="text-[#22C55E]" size={24} />;
  }
  if (currentIdx === stageIdx) {
    return <Loader2 className="text-[#4F6EF7] animate-spin" size={24} />;
  }
  return <Circle className="text-[#9CA3AF]" size={24} />;
}

export function ProcessingStatus() {
  const { interviewId, jobId } = useParams();
  const navigate = useNavigate();
  const { status, error } = useInterviewStatus(interviewId);

  useEffect(() => {
    if (status?.status === 'completed') {
      navigate(`/interview/${jobId}/confirmation?interviewId=${interviewId}`, { replace: true });
    }
  }, [status?.status, navigate, jobId, interviewId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Card className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--color-heading)' }}>
            Processing Your Interview
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-body)' }}>
            We're analyzing your responses. This may take a few minutes.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-4 text-center bg-red-50 dark:bg-red-900/20 rounded-lg p-3">{error}</p>
        )}

        <div className="flex items-start gap-10">
          {/* Left: stage checklist */}
          <div className="flex-1 space-y-0">
            {stages.map((stage) => {
              const sIdx = stageOrder.indexOf(stage.key);
              const currentIdx = stageOrder.indexOf(status?.status ?? 'uploaded');
              return (
                <div key={stage.key} className="flex gap-4">
                  {/* Vertical timeline */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-8 h-8">
                      <StageIcon stageKey={stage.key} currentStatus={status?.status ?? 'uploaded'} />
                    </div>
                    {sIdx < stageOrder.length - 1 && (
                      <div className={`w-0.5 h-10 ${currentIdx > sIdx ? 'bg-[#22C55E]' : 'bg-gray-200'}`} />
                    )}
                  </div>
                  {/* Stage content */}
                  <div className="pb-6">
                    <p className={`text-sm font-medium ${status && stageOrder.indexOf(status.status) >= sIdx ? 'text-[var(--color-heading)]' : 'text-[var(--color-muted)]'}`}>
                      {stage.label}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">{stage.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: progress ring */}
          <div className="flex flex-col items-center gap-2 shrink-0 pt-2">
            <ScoreRing score={status?.progress_pct ?? 0} size={140} strokeWidth={10} />
            <span className="text-sm font-medium text-[#4B5563]">
              {status?.progress_pct ?? 0}% complete
            </span>
          </div>
        </div>

        <p className="text-xs text-[#9CA3AF] text-center mt-8">
          You can close this page. We'll notify you once the analysis is complete.
        </p>
      </Card>
    </div>
  );
}
