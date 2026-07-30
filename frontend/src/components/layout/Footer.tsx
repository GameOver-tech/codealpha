import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-[#0F172A] text-slate-400 py-10">
      <div className="max-w-6xl mx-auto px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-lg font-bold text-white">HireLens AI</Link>
            <span className="text-slate-600 mx-2">|</span>
            <span className="text-sm">© {new Date().getFullYear()} All rights reserved</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-xs text-slate-500">
            Powered by AI
          </div>
        </div>
      </div>
    </footer>
  );
}
