import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner, Avatar, RecommendationPill, StatusPill } from '../../components/ui';
import { api } from '../../lib/api';
import { Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import type { CandidateListItem } from '../../types';

function ScoreDisplay({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-sm text-gray-400">-</span>;
  const rounded = Math.round(score);
  const color = rounded >= 80 ? 'text-[#16A34A]' : rounded >= 60 ? 'text-[#D97706]' : 'text-[#DC2626]';
  return <span className={`text-sm font-semibold ${color}`}>{rounded}/100</span>;
}

export function CandidateTable() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const perPage = 10;

  useEffect(() => {
    api.get('/admin/jobs').then((data) => {
      setJobs(data.jobs || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (search) params.set('search', search);
    if (jobFilter) params.set('job_id', jobFilter);

    api.get(`/admin/candidates?${params}`)
      .then((data) => {
        setCandidates(data.candidates || []);
        setTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, jobFilter]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-heading)' }}>Candidates</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-body)' }}>All interview evaluations</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search candidates..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6EF7]"
            style={{ color: 'var(--color-heading)', backgroundColor: 'var(--color-card)' }}
          />
        </div>
        <select
          value={jobFilter}
          onChange={(e) => { setJobFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6EF7]"
          style={{ color: 'var(--color-heading)', backgroundColor: 'var(--color-card)' }}
        >
          <option value="">All Jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : (
        <>
          {/* Table */}
          <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700" style={{ borderColor: 'var(--color-border)' }}>
                  <th className="text-left px-6 py-4 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Candidate</th>
                  <th className="text-left px-6 py-4 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Job Applied</th>
                  <th className="text-left px-6 py-4 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Overall Score</th>
                  <th className="text-left px-6 py-4 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Recommendation</th>
                  <th className="text-left px-6 py-4 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Status</th>
                  <th className="text-left px-6 py-4 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--color-bg)' }}>
                        <Users size={32} style={{ color: 'var(--color-muted)' }} />
                      </div>
                      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-heading)' }}>No candidates yet</h3>
                      <p className="text-sm" style={{ color: 'var(--color-body)' }}>Candidates will appear here once they complete their interviews.</p>
                    </td>
                  </tr>
                ) : (
                  candidates.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b cursor-pointer transition-all duration-150 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:border-l-2 hover:border-l-[#4F6EF7]"
                      style={{ borderColor: 'var(--color-border)' }}
                      onClick={() => navigate(`/admin/candidates/${c.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar src={c.photo_url} name={c.full_name} />
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--color-heading)' }}>{c.full_name}</p>
                            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-body)' }}>{c.job_title || '-'}</td>
                      <td className="px-6 py-4">
                        <ScoreDisplay score={c.overall_score} />
                      </td>
                      <td className="px-6 py-4">
                        {c.recommendation ? (
                          <RecommendationPill label={c.recommendation} />
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--color-muted)' }}>Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {c.status ? (
                          <StatusPill status={c.status} />
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--color-muted)' }}>-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-muted)' }}>
                        {c.interview_date ? new Date(c.interview_date).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-body)' }}
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      p === page ? 'bg-[#4F6EF7] text-white' : 'border hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                    style={p !== page ? { borderColor: 'var(--color-border)', color: 'var(--color-body)' } : {}}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-body)' }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
