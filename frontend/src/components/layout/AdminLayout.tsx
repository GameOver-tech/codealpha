import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, LogOut, Sun, Moon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Footer } from './Footer';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard', matchPaths: ['/admin/dashboard'] },
  { icon: Users, label: 'Candidates', path: '/admin/dashboard', matchPaths: ['/admin/dashboard', '/admin/candidates'] },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { setAdminSession } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const handleLogout = () => {
    setAdminSession(null);
    navigate('/admin/login');
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <aside
        className="w-64 text-white flex flex-col shrink-0"
        style={{
          background: 'linear-gradient(180deg, #0F172A 0%, #0B1120 100%)',
        }}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white">HireLens AI</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.matchPaths.some(p => location.pathname.startsWith(p));
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-slate-800/80 text-white border-l-2 border-[#4F6EF7] rounded-l-none'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white hover:translate-x-0.5'
                }`}
              >
                <Icon size={20} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t border-slate-800 space-y-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800/50 hover:text-white w-full transition-colors"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800/50 hover:text-white w-full transition-colors"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 min-h-full">
          {children}
        </div>
        <Footer />
      </main>
    </div>
  );
}
