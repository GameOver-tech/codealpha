import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, LoadingSpinner } from '../../components/ui';
import { RecommendationPill } from '../../components/ui';
import { api } from '../../lib/api';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CandidateListItem } from '../../types';

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
        <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
        <span className="text-sm text-gray-500">{total} total candidates</span>
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
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={jobFilter}
          onChange={(e) => { setJobFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Job Applied</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Score</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Recommendation</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">
                      No candidates found
                    </td>
                  </tr>
                ) : (
                  candidates.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/admin/candidates/${c.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 overflow-hidden">
                            {c.photo_url ? (
                              <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              c.full_name?.charAt(0) || '?'
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                            <p className="text-xs text-gray-500">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{c.job_title || '-'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {c.overall_score != null ? `${Math.round(c.overall_score)}/100` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {c.recommendation ? (
                          <RecommendationPill label={c.recommendation} />
                        ) : (
                          <span className="text-sm text-gray-400">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize
                          ${c.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                          ${c.status === 'analyzing' || c.status === 'transcribing' ? 'bg-blue-100 text-blue-800' : ''}
                          ${c.status === 'uploaded' ? 'bg-gray-100 text-gray-600' : ''}
                        `}>
                          {c.status || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
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
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      p === page ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
