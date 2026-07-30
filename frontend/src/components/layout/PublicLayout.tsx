import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Footer } from './Footer';
import { Sun, Moon } from 'lucide-react';

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <nav className="flex items-center justify-between px-8 py-4" style={{ backgroundColor: 'var(--color-card)', borderBottom: '1px solid var(--color-border)' }}>
        <Link to="/" className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
          HireLens AI
        </Link>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm font-medium" style={{ color: 'var(--color-body)' }}>Features</a>
          <a href="#" className="text-sm font-medium" style={{ color: 'var(--color-body)' }}>For Recruiters</a>
          <a href="#how-it-works" className="text-sm font-medium" style={{ color: 'var(--color-body)' }}>How it Works</a>
          <a href="#" className="text-sm font-medium" style={{ color: 'var(--color-body)' }}>Pricing</a>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-body)' }}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <Link
              to="/candidate/dashboard"
              className="px-5 py-2 rounded-xl text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/interview/new"
              className="px-5 py-2 rounded-xl text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Start Interview
            </Link>
          )}
        </div>
      </nav>
      <main>{children}</main>
      <Footer />
    </div>
  );
}
