import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PublicLayout } from '../components/layout/PublicLayout';
import { Button, Card, ScoreRing, ScoreRadarChart } from '../components/ui';
import type { RadarData } from '../components/ui';
import { Upload, Code, BarChart3, FileText, CheckCircle, ArrowRight } from 'lucide-react';

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
  const { user } = useAuth();

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-8 pt-20 pb-16 text-center">
        <h1 className="text-5xl font-bold leading-tight mb-4" style={{ color: 'var(--color-heading)' }}>
          Your AI-powered <br />
          <span style={{ color: 'var(--color-primary)' }}>talent evaluation partner</span>
        </h1>
        <p className="text-lg max-w-2xl mx-auto mb-8" style={{ color: 'var(--color-body)' }}>
          Transform your hiring with automated interview analysis. Record,
          transcribe, and evaluate candidates with cutting-edge AI — get actionable
          insights in minutes, not days.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button onClick={() => navigate(user ? '/candidate/dashboard' : '/interview/new')}>
            {user ? 'Go to Dashboard' : 'Start Interview'}
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
        <Card className="flex items-center gap-12 p-8 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <div className="flex flex-col items-center gap-3">
            <ScoreRing score={87} size={140} strokeWidth={10} />
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-[#DCFCE7] text-[#16A34A]">
              Recommended
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-heading)' }}>Sample Candidate Evaluation</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-body)' }}>
              Balanced performance across all evaluation criteria
            </p>
            <ScoreRadarChart data={sampleRadarData} />
          </div>
        </Card>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20" style={{ backgroundColor: 'var(--color-card)' }}>
        <div className="max-w-6xl mx-auto px-8">
          <h2 className="text-3xl font-bold text-center mb-12" style={{ color: 'var(--color-heading)' }}>
            How It Works
          </h2>
          <div className="grid grid-cols-5 gap-0 items-start">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="text-center relative px-2">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon style={{ color: 'var(--color-primary)' }} size={28} />
                  </div>
                  <div className="text-sm font-semibold mb-1" style={{ color: 'var(--color-primary)' }}>
                    Step {i + 1}
                  </div>
                  <h3 className="font-semibold mb-1" style={{ color: 'var(--color-heading)' }}>{step.title}</h3>
                  <p className="text-sm" style={{ color: 'var(--color-body)' }}>{step.desc}</p>
                  {i < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-8 -right-3" style={{ color: 'var(--color-muted)' }}>
                      <ArrowRight size={20} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
