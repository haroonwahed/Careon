/**
 * useTasks — fetches live CareTask records from the Django API.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';

export type ActionStatus = 'overdue' | 'today' | 'upcoming' | 'completed';

export interface SpaTask {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  actionStatus: ActionStatus;
  linkedCaseId: string;
  caseTitle: string;
  assignedTo: string;
  dueDate: string;
  createdAt: string;
}

interface UseTasksOptions {
  q?: string;
  status?: string;
}

interface UseTasksResult {
  tasks: SpaTask[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

export function useTasks(options: UseTasksOptions = {}): UseTasksResult {
  const { q = '', status = '' } = options;
  const [tasks, setTasks] = useState<SpaTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { page_size: '100' };
    if (q) params.q = q;
    if (status) params.status = status;

    apiClient.get('/care/api/tasks/', params)
      .then((data: { tasks: SpaTask[]; total_count: number }) => {
        if (cancelled) return;
        setTotalCount(data.total_count ?? 0);
        setTasks(data.tasks ?? []);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Kon taken niet laden');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, status, tick]);

  return { tasks, loading, error, totalCount, refetch };
}
