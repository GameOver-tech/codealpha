import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/ui';
import { CheckCircle } from 'lucide-react';

export function Confirmation() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Card className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="text-[#22C55E]" size={40} />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-heading)' }}>
          Interview Submitted!
        </h1>
        <p className="mb-8" style={{ color: 'var(--color-body)' }}>
          Thank you for completing your interview. Your responses are being reviewed by the recruiter.
          You will be notified once the process is complete.
        </p>
        <Button onClick={() => navigate('/')}>Go to Home</Button>
      </Card>
    </div>
  );
}
