import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Eye, EyeOff, BarChart3, Users, CheckCircle, Sparkles } from 'lucide-react';

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
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12"
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
        }}
      >
        {/* Decorative grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#4F6EF7 1px, transparent 1px), linear-gradient(90deg, #4F6EF7 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Glowing orbs */}
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-[#4F6EF7]/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-[#22C55E]/5 blur-3xl" />

        <div className="relative text-white max-w-md text-center">
          {/* Logo mark */}
          <div className="w-16 h-16 bg-gradient-to-br from-[#4F6EF7] to-[#3D5BD9] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#4F6EF7]/30">
            <Sparkles className="text-white" size={30} />
          </div>

          <h1 className="text-3xl font-bold mb-3">Welcome Back</h1>
          <p className="text-slate-400 text-base mb-10 max-w-sm mx-auto leading-relaxed">
            Sign in to manage candidates, review evaluations, and make data-driven hiring decisions.
          </p>

          {/* Feature cards */}
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            {[
              { icon: Users, label: 'Candidates', color: '#4F6EF7', desc: 'Track all applicants' },
              { icon: BarChart3, label: 'Reports', color: '#22C55E', desc: 'AI-powered insights' },
              { icon: CheckCircle, label: 'Decisions', color: '#F59E0B', desc: 'Hire with confidence' },
            ].map(({ icon: Icon, label, color, desc }) => (
              <div key={label} className="text-center p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: `${color}20` }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <p className="text-xs font-medium text-white mb-0.5">{label}</p>
                <p className="text-[10px] text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex items-center justify-center p-8"
        style={{
          background: 'linear-gradient(135deg, var(--color-bg) 0%, #EDF0F7 100%)',
        }}
      >
        <Card className="max-w-sm w-full relative overflow-hidden" hover={false}>
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4F6EF7] via-[#22C55E] to-[#F59E0B]" />

          <div className="pt-4">
            {/* Mobile-only logo */}
            <div className="lg:hidden w-14 h-14 bg-gradient-to-br from-[#4F6EF7] to-[#3D5BD9] rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#4F6EF7]/20">
              <Sparkles className="text-white" size={24} />
            </div>

            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-heading)' }}>Admin Login</h1>
            <p className="text-sm mb-8" style={{ color: 'var(--color-body)' }}>Sign in to access your dashboard</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                placeholder="admin@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--color-body)' }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-gray-300 text-[#4F6EF7] focus:ring-[#4F6EF7] cursor-pointer"
                  />
                  Remember me
                </label>
                <a href="#" className="text-[#4F6EF7] hover:underline font-medium">Forgot password?</a>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">{error}</p>
              )}

              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <p className="mt-6 text-xs text-center" style={{ color: 'var(--color-muted)' }}>
              © {new Date().getFullYear()} HireLens AI. All rights reserved.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
