/**
 * useCases — fetches live CareCase records from the Django API and maps
 * them to the shape expected by CasussenPage / CaseTriageCard.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';

// ---- API response types ------------------------------------------------

interface ApiCase {
  id: string;
  title: string;
  status: string;            // DRAFT | PENDING | IN_REVIEW | APPROVED | ACTIVE | ...
  case_phase: string;        // intake | beoordeling | matching | plaatsing | actief | afgerond
  risk_level: string;        // LOW | MEDIUM | HIGH | CRITICAL
  service_region: string;
  contract_type: string;
  preferred_provider: string;
  content: string;
  owner: string;
  created_at: string | null;
  updated_at: string | null;
}

interface ApiListResponse {
  contracts: ApiCase[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ---- SPA case shape (matches CaseTriageCard props) ---------------------

export type CasePhase = 'intake' | 'beoordeling' | 'matching' | 'plaatsing' | 'afgerond';
export type UrgencyLevel = 'critical' | 'warning' | 'normal' | 'stable';

export interface SpaCase {
  id: string;
  title: string;
  regio: string;
  zorgtype: string;
  wachttijd: number;
  status: CasePhase;
  urgency: UrgencyLevel;
  problems: { type: 'no-match' | 'missing-assessment' | 'capacity' | 'delayed'; label: string }[];
  systemInsight: string;
  recommendedAction: string;
}

// ---- Mapping helpers ---------------------------------------------------

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  NDA: 'Intakeafspraak',
  MSA: 'Regieafspraak',
  SOW: 'Uitvoeringsafspraak',
  EMPLOYMENT: 'Personele inzet',
  LEASE: 'Capaciteitsafspraak',
  LICENSE: 'Toegangsafspraak',
  VENDOR: 'Aanbiedersafspraak',
  PARTNERSHIP: 'Samenwerkingsafspraak',
  SETTLEMENT: 'Afstemmingsafspraak',
  AMENDMENT: 'Wijzigingsafspraak',
};

function mapPhase(phase: string): CasePhase {
  const valid: CasePhase[] = ['intake', 'beoordeling', 'matching', 'plaatsing', 'afgerond'];
  return valid.includes(phase as CasePhase) ? (phase as CasePhase) : 'intake';
}

function mapUrgency(riskLevel: string): UrgencyLevel {
  switch (riskLevel?.toUpperCase()) {
    case 'CRITICAL': return 'critical';
    case 'HIGH':     return 'warning';
    case 'MEDIUM':   return 'normal';
    default:         return 'stable';
  }
}

function daysAgo(isoDate: string | null): number {
  if (!isoDate) return 0;
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function deriveProblems(
  phase: CasePhase,
  urgency: UrgencyLevel,
  wachttijd: number,
): SpaCase['problems'] {
  const problems: SpaCase['problems'] = [];
  if (urgency === 'critical' && phase === 'matching') {
    problems.push({ type: 'no-match', label: 'Geen passende match gevonden' });
  }
  if (wachttijd > 10 && phase !== 'afgerond') {
    problems.push({ type: 'delayed', label: `Wachttijd > ${wachttijd} dagen` });
  }
  if (phase === 'beoordeling' && urgency !== 'stable') {
    problems.push({ type: 'missing-assessment', label: 'Beoordeling in behandeling' });
  }
  return problems;
}

function deriveRecommendedAction(phase: CasePhase): string {
  switch (phase) {
    case 'intake':       return 'Start beoordeling';
    case 'beoordeling':  return 'Afronden en doorsturen naar matching';
    case 'matching':     return 'Selecteer aanbieder';
    case 'plaatsing':    return 'Bevestig plaatsing';
    case 'afgerond':     return 'Bekijk afsluiting';
  }
}

function mapApiCase(c: ApiCase): SpaCase {
  const phase = mapPhase(c.case_phase);
  const urgency = mapUrgency(c.risk_level);
  const wachttijd = daysAgo(c.created_at);

  return {
    id: c.id,
    title: c.title,
    regio: c.service_region || '—',
    zorgtype: CONTRACT_TYPE_LABELS[c.contract_type] || c.contract_type || 'Zorgafspraak',
    wachttijd,
    status: phase,
    urgency,
    problems: deriveProblems(phase, urgency, wachttijd),
    systemInsight: c.content ? c.content.slice(0, 160) : '',
    recommendedAction: deriveRecommendedAction(phase),
  };
}

// ---- Hook --------------------------------------------------------------

export interface UseCasesOptions {
  q?: string;
  status?: string[];
  page?: number;
}

export interface UseCasesResult {
  cases: SpaCase[];
  totalCount: number;
  totalPages: number;
  page: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCases(options: UseCasesOptions = {}): UseCasesResult {
  const { q = '', status = [], page = 1 } = options;

  const [cases, setCases] = useState<SpaCase[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: Record<string, string | number | string[]> = { page };
    if (q) params['q'] = q;
    if (status.length) params['status'] = status;

    apiClient
      .get<ApiListResponse>('/care/api/cases/', params)
      .then(data => {
        if (!cancelled) {
          setCases((data.contracts ?? []).map(mapApiCase));
          setTotalCount(data.total_count ?? 0);
          setTotalPages(data.total_pages ?? 1);
        }
      })
      .catch(err => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, JSON.stringify(status), page, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return { cases, totalCount, totalPages, page, loading, error, refetch };
}
