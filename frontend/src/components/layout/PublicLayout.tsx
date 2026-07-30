import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200">
        <Link to="/" className="text-xl font-bold text-blue-600">
          HireLens AI
        </Link>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Features</a>
          <a href="#" className="text-gray-600 hover:text-gray-900 text-sm font-medium">For Recruiters</a>
          <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 text-sm font-medium">How it Works</a>
          <a href="#" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Pricing</a>
          <Link
            to="/interview/new"
            className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Start Interview
          </Link>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
