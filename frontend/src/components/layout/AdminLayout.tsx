import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, FileText, Settings, LogOut, Sun, Moon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Footer } from './Footer';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard', matchPaths: ['/admin/dashboard'] },
  { icon: Users, label: 'Candidates', path: '/admin/dashboard', matchPaths: ['/admin/dashboard', '/admin/candidates'] },
  { icon: Briefcase, label: 'Jobs', path: '/admin/dashboard', matchPaths: ['/admin/dashboard'] },
  { icon: FileText, label: 'Reports', path: '/admin/dashboard', matchPaths: ['/admin/dashboard'] },
  { icon: Settings, label: 'Settings', path: '/admin/dashboard', matchPaths: ['/admin/dashboard'] },
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
      <aside className="w-64 text-white flex flex-col shrink-0 dark:bg-slate-950" style={{ backgroundColor: '#0F172A' }}>
        <div className="p-6">
          <h1 className="text-xl font-bold text-white">HireLens AI</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.matchPaths.some(p => location.pathname.startsWith(p));
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white w-full transition-colors"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white w-full transition-colors"
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
