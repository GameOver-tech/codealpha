import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/ui';
import { CheckCircle } from 'lucide-react';

export function Confirmation() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="text-[#22C55E]" size={40} />
        </div>
        <h1 className="text-2xl font-bold text-[#111827] mb-2">
          Interview Submitted!
        </h1>
        <p className="text-[#4B5563] mb-8">
          Thank you for completing your interview. Your responses are being reviewed by the recruiter.
          You will be notified once the process is complete.
        </p>
        <Button onClick={() => navigate('/')}>Go to Home</Button>
      </Card>
    </div>
  );
}
