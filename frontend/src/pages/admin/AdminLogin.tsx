import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export function AdminLogin() {
  const navigate = useNavigate();
  const { setAdminSession } = useAuth();
  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await api.adminLogin(email, password);
      setAdminSession(result.access_token);
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left illustration area */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 items-center justify-center p-12">
        <div className="text-white max-w-md">
          <h1 className="text-4xl font-bold mb-4">HireLens AI</h1>
          <p className="text-blue-100 text-lg">
            AI-powered candidate evaluation platform. Analyze interviews, generate reports, and make data-driven hiring decisions.
          </p>
        </div>
      </div>

      {/* Right form area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-sm w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-gray-500 text-sm mb-8">Sign in to your admin account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Remember me
              </label>
              <a href="#" className="text-blue-600 hover:underline">Forgot password?</a>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
            )}

            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
