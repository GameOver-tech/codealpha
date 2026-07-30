import { Link, useNavigate } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';
import { Button, Card, ScoreRing, ScoreRadarChart } from '../components/ui';
import type { RadarData } from '../components/ui';
import { Upload, Code, BarChart3, FileText, CheckCircle } from 'lucide-react';

const steps = [
  { icon: Upload, title: 'Upload', desc: 'Candidate submits interview recording' },
  { icon: Code, title: 'Transcribe', desc: 'AI converts speech to text' },
  { icon: BarChart3, title: 'Analyze', desc: 'Multi-AI evaluation & scoring' },
  { icon: FileText, title: 'Report', desc: 'Detailed report generated' },
  { icon: CheckCircle, title: 'Recommend', desc: 'Hire/no-hire recommendation' },
];

const sampleRadarData: RadarData[] = [
  { subject: 'Technical', score: 85, fullMark: 100 },
  { subject: 'Communication', score: 72, fullMark: 100 },
  { subject: 'Confidence', score: 78, fullMark: 100 },
  { subject: 'Problem Solving', score: 90, fullMark: 100 },
  { subject: 'Experience', score: 82, fullMark: 100 },
];

export function Landing() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-8 pt-20 pb-16 text-center">
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-4">
          AI-Powered Interview<br />
          <span className="text-blue-600">Intelligence Platform</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          Transform your hiring process with automated interview analysis. Record,
          transcribe, and evaluate candidates with cutting-edge AI — get actionable
          insights in minutes, not days.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button onClick={() => navigate('/interview/new')}>
            Start Interview
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/admin/login')}
          >
            For Recruiters
          </Button>
        </div>
      </section>

      {/* Preview Card */}
      <section className="max-w-4xl mx-auto px-8 pb-16">
        <Card className="flex items-center gap-12 p-8">
          <div className="flex flex-col items-center gap-3">
            <ScoreRing score={87} size={140} strokeWidth={10} />
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Recommended
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sample Candidate Evaluation</h3>
            <p className="text-sm text-gray-500 mb-4">
              Balanced performance across all evaluation criteria
            </p>
            <ScoreRadarChart data={sampleRadarData} />
          </div>
        </Card>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-5 gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="text-center">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon className="text-blue-600" size={28} />
                  </div>
                  <div className="text-sm font-semibold text-blue-600 mb-1">
                    Step {i + 1}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                  <p className="text-sm text-gray-500">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
