import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui';
import { ScoreRing } from '../components/ui';
import { useInterviewStatus } from '../hooks/useInterviewStatus';
import { CheckCircle, Loader2, Circle } from 'lucide-react';

const stages = [
  { key: 'uploaded', label: 'Uploaded', percent: 0 },
  { key: 'transcribing', label: 'Transcribing Audio', percent: 25 },
  { key: 'analyzing', label: 'Analyzing Responses', percent: 60 },
  { key: 'completed', label: 'Generating Report', percent: 100 },
] as const;

function StageIcon({ stageKey, currentStatus }: { stageKey: string; currentStatus: string }) {
  // Completed if currentStatus index > stage index
  const stageOrder = ['uploaded', 'transcribing', 'analyzing', 'completed'];
  const stageIdx = stageOrder.indexOf(stageKey);
  const currentIdx = stageOrder.indexOf(currentStatus);

  if (currentIdx > stageIdx) {
    return <CheckCircle className="text-green-500" size={24} />;
  }
  if (currentIdx === stageIdx) {
    return <Loader2 className="text-blue-600 animate-spin" size={24} />;
  }
  return <Circle className="text-gray-300" size={24} />;
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <ScoreRing score={status?.progress_pct ?? 0} size={100} strokeWidth={6} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Processing Your Interview
          </h1>
          <p className="text-sm text-gray-500">
            Please wait while we analyze your responses...
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-4 text-center">{error}</p>
        )}

        <div className="space-y-4">
          {stages.map((stage) => (
            <div
              key={stage.key}
              className="flex items-center gap-4 p-3 rounded-lg bg-gray-50"
            >
              <StageIcon stageKey={stage.key} currentStatus={status?.status ?? 'uploaded'} />
              <div>
                <p className="text-sm font-medium text-gray-900">{stage.label}</p>
                <p className="text-xs text-gray-500">
                  {stage.key === 'uploaded' && status?.status === 'uploaded'
                    ? 'Waiting to start...'
                    : stage.key === 'transcribing' && status?.status === 'transcribing'
                    ? 'Converting speech to text...'
                    : stage.key === 'analyzing' && status?.status === 'analyzing'
                    ? 'Running AI evaluation...'
                    : stage.key === 'completed' && status?.status === 'completed'
                    ? 'Report ready!'
                    : 'Complete'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
