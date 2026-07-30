import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/ui';
import { CheckCircle } from 'lucide-react';

export function Confirmation() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="text-green-600" size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Interview Submitted!
        </h1>
        <p className="text-gray-500 mb-8">
          Your responses are being analyzed. Your recruiter will receive the evaluation once processing is complete.
        </p>
        <Button onClick={() => navigate('/')}>Go to Home</Button>
      </Card>
    </div>
  );
}
