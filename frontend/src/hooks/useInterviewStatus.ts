import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { InterviewStatus } from '../types';

export function useInterviewStatus(interviewId: string | undefined) {
  const [status, setStatus] = useState<InterviewStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    if (!interviewId) return;
    try {
      const data = await api.get(`/interviews/${interviewId}/status`);
      setStatus(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to get status');
    }
  }, [interviewId]);

  useEffect(() => {
    if (!interviewId) return;

    poll(); // immediate first fetch
    const interval = setInterval(poll, 2000);

    return () => clearInterval(interval);
  }, [interviewId, poll]);

  return { status, error };
}
