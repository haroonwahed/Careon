/**
 * useRegions — fetches live RegionalConfiguration records from the Django API.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../lib/apiClient';
import { useCases } from './useCases';
import { useProviders } from './useProviders';
import { buildWorkflowCases } from '../lib/workflowUi';

export type RegionHealthStatus = 'stabiel' | 'druk' | 'tekort' | 'kritiek';

interface RawRegion {
  id: string;
  name: string;
  code: string;
  regionType: string;
  status: string;
  configurationStatus?: string;
  maxWaitDays: number | null;
  providerCount: number;
  municipalityCount: number;
  coordinator: string;
  province?: string;

  // Optional backend-computed region health payload.
  actieve_casussen?: number;
  beschikbare_capaciteit?: number;
  capaciteitsratio?: number;
  gemiddelde_wachttijd_dagen?: number;
  urgente_casussen_zonder_match?: number;
  vastgelopen_casussen?: number;
  status_label?: 'Stabiel' | 'Druk' | 'Tekort' | 'Kritiek';
  heeft_tekort?: boolean;
  heeft_hoge_wachttijd?: boolean;
  heeft_kritiek_signaal?: boolean;
  signaal_samenvatting?: string;
  providerCountComputed?: number;
}

function normalizeRegionKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isUrgentCase(urgency: 'critical' | 'warning' | 'normal' | 'stable'): boolean {
  return urgency === 'critical' || urgency === 'warning';
}

function buildSignalSummary(input: {
  status: RegionHealthStatus;
  urgente_casussen_zonder_match: number;
  gemiddelde_wachttijd_dagen: number;
  vastgelopen_casussen: number;
  beschikbare_capaciteit: number;
  actieve_casussen: number;
  capaciteitsratio: number;
}): string {
  if (input.status === 'stabiel') return 'Geen capaciteitsproblemen';

  if (input.beschikbare_capaciteit === 0 && input.actieve_casussen > 0) {
    return 'Geen beschikbare capaciteit';
  }

  if (input.urgente_casussen_zonder_match > 0) {
    return input.urgente_casussen_zonder_match === 1
      ? '1 urgente casus zonder match'
      : `${input.urgente_casussen_zonder_match} urgente casussen zonder match`;
  }

  if (input.gemiddelde_wachttijd_dagen > 14) {
    return 'Wachttijd boven norm';
  }

  if (input.vastgelopen_casussen > 0) {
    return input.vastgelopen_casussen === 1
      ? '1 vastgelopen casus'
      : `${input.vastgelopen_casussen} vastgelopen casussen`;
  }

  if (input.capaciteitsratio < 0.4) {
    return 'Capaciteit onder druk';
  }

  return 'Capaciteit onder druk';
}

function computeRegionStatus(input: {
  beschikbare_capaciteit: number;
  actieve_casussen: number;
  urgente_casussen_zonder_match: number;
  gemiddelde_wachttijd_dagen: number;
  vastgelopen_casussen: number;
  capaciteitsratio: number;
}): RegionHealthStatus {
  // Deterministic status model, ordered by severity.
  if (
    (input.beschikbare_capaciteit === 0 && input.actieve_casussen > 0)
    || input.urgente_casussen_zonder_match >= 4
    || input.gemiddelde_wachttijd_dagen > 42
    || input.vastgelopen_casussen >= 5
  ) {
    return 'kritiek';
  }

  if (
    input.capaciteitsratio < 0.2
    || input.urgente_casussen_zonder_match >= 2
    || input.gemiddelde_wachttijd_dagen > 28
    || input.vastgelopen_casussen >= 3
  ) {
    return 'tekort';
  }

  if (
    input.capaciteitsratio < 0.4
    || input.urgente_casussen_zonder_match >= 1
    || input.gemiddelde_wachttijd_dagen > 14
    || input.vastgelopen_casussen >= 1
  ) {
    return 'druk';
  }

  return 'stabiel';
}

export interface SpaRegion {
  id: string;
  name: string;
  code: string;
  regionType: string;
  configurationStatus: string;
  maxWaitDays: number | null;
  providerCount: number;
  municipalityCount: number;
  coordinator: string;

  // Requested computed fields
  actieve_casussen: number;
  beschikbare_capaciteit: number;
  capaciteitsratio: number;
  gemiddelde_wachttijd_dagen: number;
  urgente_casussen_zonder_match: number;
  vastgelopen_casussen: number;
  status: RegionHealthStatus;
  status_label: 'Stabiel' | 'Druk' | 'Tekort' | 'Kritiek';
  heeft_tekort: boolean;
  heeft_hoge_wachttijd: boolean;
  heeft_kritiek_signaal: boolean;
  signaal_samenvatting: string;

  // Backward-compatible aliases for existing cards
  casesCount: number;
  gemeentenCount: number;
  providersCount: number;
  avgWaitingTime: number;
  capacityStatus: 'normal' | 'busy' | 'shortage' | 'critical';
  totalCapacity: number;
  usedCapacity: number;
  trend: 'up' | 'down' | 'stable';
}

interface UseRegionsOptions {
  q?: string;
}

interface UseRegionsResult {
  regions: SpaRegion[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

export function useRegions(options: UseRegionsOptions = {}): UseRegionsResult {
  const { q = '' } = options;
  const [rawRegions, setRawRegions] = useState<RawRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [tick, setTick] = useState(0);

  const {
    cases,
    loading: casesLoading,
    error: casesError,
  } = useCases({ q: '' });
  const {
    providers,
    loading: providersLoading,
    error: providersError,
  } = useProviders({ q: '' });

  const providersForWorkflow = useMemo(
    () => providers.map((provider) => ({
      ...provider,
      region: provider.regionLabel || provider.region || provider.city,
    })),
    [providers],
  );

  const workflowCases = useMemo(
    () => buildWorkflowCases(cases, providersForWorkflow),
    [cases, providersForWorkflow],
  );

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { page_size: '100' };
    if (q) params.q = q;

    apiClient.get('/care/api/regions/health/', params)
      .then((data: { regions: RawRegion[]; total_count: number }) => {
        if (cancelled) return;
        setTotalCount(data.total_count ?? 0);
        setRawRegions(data.regions ?? []);
        setLoading(false);
      })
      .catch((err: Error) => {
        // Fallback to metadata endpoint and compute health client-side.
        apiClient.get('/care/api/regions/', params)
          .then((data: { regions: RawRegion[]; total_count: number }) => {
            if (cancelled) return;
            setTotalCount(data.total_count ?? 0);
            setRawRegions(data.regions ?? []);
            setLoading(false);
          })
          .catch((fallbackErr: Error) => {
            if (cancelled) return;
            const backendError = err.message ?? 'Kon regio\'s niet laden';
            const fallbackError = fallbackErr.message ?? 'Fallback laden mislukt';
            setError(`${backendError}. ${fallbackError}`);
            setLoading(false);
          });
      });

    return () => { cancelled = true; };
  }, [q, tick]);

  const regions = useMemo<SpaRegion[]>(() => {
    if (rawRegions.length === 0) return [];

    return rawRegions.map((region) => {
      const hasBackendHealth = typeof region.actieve_casussen === 'number'
        && typeof region.beschikbare_capaciteit === 'number'
        && typeof region.capaciteitsratio === 'number'
        && typeof region.gemiddelde_wachttijd_dagen === 'number'
        && typeof region.urgente_casussen_zonder_match === 'number'
        && typeof region.vastgelopen_casussen === 'number'
        && (region.status === 'stabiel' || region.status === 'druk' || region.status === 'tekort' || region.status === 'kritiek');

      const regionKeys = new Set<string>([
        normalizeRegionKey(region.name),
        normalizeRegionKey(region.code),
      ]);

      const regionCases = workflowCases.filter((workflowCase) => {
        const caseRegion = normalizeRegionKey(workflowCase.region);
        return caseRegion.length > 0 && regionKeys.has(caseRegion);
      });

      const actieveCases = regionCases.filter((workflowCase) => workflowCase.phase !== 'afgerond');

      const regionProviders = providersForWorkflow.filter((provider) => {
        const providerKeys = [
          normalizeRegionKey(provider.regionLabel),
          normalizeRegionKey(provider.region),
          normalizeRegionKey(provider.city),
        ];
        return providerKeys.some((key) => key.length > 0 && regionKeys.has(key));
      });

      const beschikbareCapaciteit = regionProviders.reduce(
        (sum, provider) => sum + Math.max(provider.availableSpots ?? 0, 0),
        0,
      );

      const computed_actieve_casussen = actieveCases.length;
      const computed_gemiddelde_wachttijd = computed_actieve_casussen > 0
        ? Math.round(actieveCases.reduce((sum, workflowCase) => sum + workflowCase.daysInCurrentPhase, 0) / computed_actieve_casussen)
        : 0;

      const urgenteZonderMatch = actieveCases.filter((workflowCase) => {
        if (!isUrgentCase(workflowCase.urgency)) return false;
        return workflowCase.recommendedProvidersCount <= 0 || workflowCase.isBlocked;
      }).length;

      const vastgelopenCasussen = actieveCases.filter((workflowCase) => {
        if (workflowCase.phase === 'beoordeling') {
          return workflowCase.daysInCurrentPhase > 3;
        }
        if (workflowCase.phase === 'matching') {
          const threshold = isUrgentCase(workflowCase.urgency) ? 2 : 5;
          return workflowCase.daysInCurrentPhase > threshold;
        }
        if (workflowCase.phase === 'plaatsing') {
          return workflowCase.daysInCurrentPhase > 5;
        }
        return false;
      }).length;

      const computed_capaciteitsratio = computed_actieve_casussen > 0 ? beschikbareCapaciteit / computed_actieve_casussen : 1;

      const actieve_casussen = hasBackendHealth ? Number(region.actieve_casussen) : computed_actieve_casussen;
      const beschikbare_capaciteit = hasBackendHealth ? Number(region.beschikbare_capaciteit) : beschikbareCapaciteit;
      const gemiddelde_wachttijd_dagen = hasBackendHealth ? Number(region.gemiddelde_wachttijd_dagen) : computed_gemiddelde_wachttijd;
      const urgente_casussen_zonder_match = hasBackendHealth ? Number(region.urgente_casussen_zonder_match) : urgenteZonderMatch;
      const vastgelopen_casussen = hasBackendHealth ? Number(region.vastgelopen_casussen) : vastgelopenCasussen;
      const capaciteitsratio = hasBackendHealth ? Number(region.capaciteitsratio) : computed_capaciteitsratio;

      const computedStatus = computeRegionStatus({
        beschikbare_capaciteit,
        actieve_casussen,
        urgente_casussen_zonder_match,
        gemiddelde_wachttijd_dagen,
        vastgelopen_casussen,
        capaciteitsratio,
      });

      const status = hasBackendHealth ? (region.status as RegionHealthStatus) : computedStatus;
      const statusLabel: SpaRegion['status_label'] = hasBackendHealth && region.status_label
        ? region.status_label
        : computedStatus === 'stabiel'
          ? 'Stabiel'
          : computedStatus === 'druk'
            ? 'Druk'
            : computedStatus === 'tekort'
              ? 'Tekort'
              : 'Kritiek';

      const signaalSamenvatting = hasBackendHealth && region.signaal_samenvatting
        ? region.signaal_samenvatting
        : buildSignalSummary({
        status,
        urgente_casussen_zonder_match,
        gemiddelde_wachttijd_dagen,
        vastgelopen_casussen,
        beschikbare_capaciteit,
        actieve_casussen,
        capaciteitsratio,
      });

      const totalCapacity = beschikbare_capaciteit + actieve_casussen;
      const usedCapacity = actieve_casussen;

      return {
        id: region.id,
        name: region.name,
        code: region.code,
        regionType: region.regionType,
        configurationStatus: region.configurationStatus ?? region.status,
        maxWaitDays: region.maxWaitDays,
        providerCount: region.providerCount,
        municipalityCount: region.municipalityCount,
        coordinator: region.coordinator,

        actieve_casussen,
        beschikbare_capaciteit,
        capaciteitsratio: Number(capaciteitsratio.toFixed(2)),
        gemiddelde_wachttijd_dagen,
        urgente_casussen_zonder_match,
        vastgelopen_casussen,
        status,
        status_label: statusLabel,
        heeft_tekort: typeof region.heeft_tekort === 'boolean' ? region.heeft_tekort : (status === 'tekort' || status === 'kritiek'),
        heeft_hoge_wachttijd: typeof region.heeft_hoge_wachttijd === 'boolean' ? region.heeft_hoge_wachttijd : (gemiddelde_wachttijd_dagen > 14),
        heeft_kritiek_signaal: typeof region.heeft_kritiek_signaal === 'boolean' ? region.heeft_kritiek_signaal : (status === 'kritiek'),
        signaal_samenvatting: signaalSamenvatting,

        casesCount: actieve_casussen,
        gemeentenCount: region.municipalityCount,
        providersCount: hasBackendHealth && typeof region.providerCountComputed === 'number'
          ? region.providerCountComputed
          : regionProviders.length,
        avgWaitingTime: gemiddelde_wachttijd_dagen,
        capacityStatus: status === 'kritiek'
          ? 'critical'
          : status === 'tekort'
            ? 'shortage'
            : status === 'druk'
              ? 'busy'
              : 'normal',
        totalCapacity,
        usedCapacity,
        trend: 'stable',
      };
    });
  }, [rawRegions, workflowCases, providersForWorkflow]);

  const combinedLoading = loading || casesLoading || providersLoading;
  const combinedError = error ?? casesError ?? providersError;

  return { regions, loading: combinedLoading, error: combinedError, totalCount, refetch };
}
