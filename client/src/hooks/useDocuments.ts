/**
 * useDocuments — fetches live Document records from the Django API.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';

export interface SpaDocument {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string;
  linkedCaseId: string;
  linkedCaseName: string;
  uploadedBy: string;
  uploadDate: string;
  fileSize: number | null;
  mimeType: string;
  version: number;
  isConfidential: boolean;
}

interface UseDocumentsOptions {
  q?: string;
}

interface UseDocumentsResult {
  documents: SpaDocument[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

export function useDocuments(options: UseDocumentsOptions = {}): UseDocumentsResult {
  const { q = '' } = options;
  const [documents, setDocuments] = useState<SpaDocument[]>([]);
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

    apiClient.get('/care/api/documents/', params)
      .then((data: { documents: SpaDocument[]; total_count: number }) => {
        if (cancelled) return;
        setTotalCount(data.total_count ?? 0);
        setDocuments(data.documents ?? []);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Kon documenten niet laden');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, tick]);

  return { documents, loading, error, totalCount, refetch };
}
