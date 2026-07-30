import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Eye, EyeOff, BarChart3, Users, CheckCircle } from 'lucide-react';

export function AdminLogin() {
  const navigate = useNavigate();
  const { setAdminSession } = useAuth();
  const { toast } = useToast();
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
      toast({ title: 'Login successful', description: 'Welcome to HireLens AI admin.', type: 'success' });
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      toast({ title: 'Login failed', description: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left illustration area */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0F172A] items-center justify-center p-12">
        <div className="text-white max-w-md text-center">
          <h1 className="text-4xl font-bold mb-2">HireLens AI</h1>
          <p className="text-slate-400 text-lg mb-12">
            AI-powered candidate evaluation platform
          </p>

          {/* Decorative illustration */}
          <div className="relative mx-auto w-72">
            {/* Desk monitor */}
            <div className="bg-slate-800 rounded-xl p-6 mb-4 text-left">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              {/* Bar chart */}
              <div className="flex items-end gap-2 h-20">
                <div className="w-8 bg-[#4F6EF7] rounded-t" style={{ height: '70%' }} />
                <div className="w-8 bg-[#22C55E] rounded-t" style={{ height: '90%' }} />
                <div className="w-8 bg-[#F59E0B] rounded-t" style={{ height: '50%' }} />
                <div className="w-8 bg-[#4F6EF7] rounded-t opacity-60" style={{ height: '80%' }} />
                <div className="w-8 bg-[#22C55E] rounded-t opacity-60" style={{ height: '60%' }} />
              </div>
              {/* Radar dots */}
              <div className="flex justify-center gap-6 mt-6">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-[#4F6EF7]/20 flex items-center justify-center">
                    <Users size={20} className="text-[#4F6EF7]" />
                  </div>
                  <span className="text-xs text-slate-400 mt-1">Candidates</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                    <BarChart3 size={20} className="text-[#22C55E]" />
                  </div>
                  <span className="text-xs text-slate-400 mt-1">Reports</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-[#F59E0B]/20 flex items-center justify-center">
                    <CheckCircle size={20} className="text-[#F59E0B]" />
                  </div>
                  <span className="text-xs text-slate-400 mt-1">Decisions</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form area */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ backgroundColor: 'var(--color-bg)' }}>
        <Card className="max-w-sm w-full">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-heading)' }}>Admin Login</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--color-body)' }}>Sign in to your admin account</p>

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
              <label className="flex items-center gap-2" style={{ color: 'var(--color-body)' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-gray-300 text-[#4F6EF7] focus:ring-[#4F6EF7]"
                />
                Remember me
              </label>
              <a href="#" className="text-[#4F6EF7] hover:underline">Forgot password?</a>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">{error}</p>
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
