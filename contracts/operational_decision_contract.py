"""
Shared Operational Decision Contract
====================================

Centralizes operational decision logic for all pages.

Purpose
-------
This module provides ONE shared source of truth for operational decisions:
- recommended_action: What the system recommends the operator do now
- impact_summary: Why that action matters (outcome-focused language)
- attention_band: App-wide urgency level (now/today/monitor/waiting)
- priority_rank: Numeric rank for sorting/triage (1=highest)
- bottleneck_state: What flow stage is blocked (matching/placement)
- escalation_recommended: Boolean indicating escalation need

Architecture
-----------
All pages (Regiekamer, Casussen, Matching, Plaatsingen)
consume OperationalDecision objects computed by this service.

The service receives case data and returns complete decisions.
No logic duplication, no page-specific forks.

No business logic lives in UI components.
All decisions made here, UI components only render.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from django.db.models import Q
from django.urls import reverse
from django.utils import timezone as django_timezone

from contracts.case_intelligence import calculate_provider_response_sla, evaluate_case_intelligence
from contracts.models import (
    CareSignal,
    CaseAssessment,
    CaseIntakeProcess,
    PlacementRequest,
)


# =========================================================================
# Enums and Constants
# =========================================================================

class AttentionBandLevel(str, Enum):
    """App-wide urgency vocabulary (single source of truth)."""
    NOW = "now"            # Directe actie
    TODAY = "today"        # Vandaag oppakken
    MONITOR = "monitor"    # Monitoren
    WAITING = "waiting"    # Wacht op externe partij


class PriorityRankBand(str, Enum):
    """Priority tiers for sorting/triage."""
    FIRST = "first"        # Rank 1-5: Highest
    SOON = "soon"          # Rank 6-15: Soon
    MONITOR = "monitor"    # Rank 16-30: Monitor
    WAITING = "waiting"    # Rank 31-50: Waiting
    ESCALATE = "escalate"  # Special: Escalation needed


class BottleneckState(str, Enum):
    """Which flow stage is blocked."""
    MATCHING = "matching"        # Blokkeert matching
    PLACEMENT = "placement"      # Blokkeert plaatsing
    NONE = "none"                # No bottleneck


# =========================================================================
# Data Classes
# =========================================================================

@dataclass
class RecommendedAction:
    """Structured recommended action (from governance logic)."""
    label: str                          # "Rond beoordeling af"
    reason: str                         # "Zonder dit kan matching niet starten"
    action_type: str = "default"       # review|assign|escalate|monitor|rematch
    target_url: Optional[str] = None   # Where to perform action
    
    def is_valid(self) -> bool:
        """Check if action is complete and actionable."""
        return bool(self.label and self.reason)


@dataclass
class ImpactSummary:
    """Outcome-focused language for action impact."""
    text: str                           # "Ontgrendelt vervolgstap"
    impact_type: str = "positive"      # positive|protective|accelerating
    
    def is_valid(self) -> bool:
        """Check if impact is meaningful."""
        return bool(self.text)


@dataclass
class OperationalDecision:
    """
    Complete operational decision for a single case.
    
    This is the unified contract that all pages consume.
    Computed once, used everywhere.
    """
    # Core fields (required)
    case_id: int
    case_title: str
    case_status: str                           # ProcessStatus value
    urgency: str                               # Urgency value
    
    # Decision fields (always present, fallback-safe)
    recommended_action: Optional[RecommendedAction]
    impact_summary: Optional[ImpactSummary]
    attention_band: AttentionBandLevel
    priority_rank: int                         # 1-100 (1=highest)
    bottleneck_state: BottleneckState
    escalation_recommended: bool
    
    # Supporting fields (for rich context)
    priority_band: PriorityRankBand           # Grouped version of priority_rank
    blocker_key: Optional[str] = None          # The dominant blocker
    blocker_label: Optional[str] = None        # Human-readable blocker
    waiting_days: int = 0
    open_signal_count: int = 0
    assessment_status: Optional[str] = None
    placement_status: Optional[str] = None
    provider_response_status: Optional[str] = None
    sla_state: Optional[str] = None            # ON_TRACK|AT_RISK|OVERDUE|ESCALATED|FORCED_ACTION
    
    # Computed properties
    is_urgent: bool = False
    is_stalled: bool = False
    requires_action: bool = False
    
    # Metadata
    computed_at: datetime = field(default_factory=lambda: django_timezone.now())
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dict for API/template rendering."""
        return {
            'case_id': self.case_id,
            'case_title': self.case_title,
            'case_status': self.case_status,
            'urgency': self.urgency,
            'recommended_action': {
                'label': self.recommended_action.label,
                'reason': self.recommended_action.reason,
                'type': self.recommended_action.action_type,
                'url': self.recommended_action.target_url,
            } if self.recommended_action else None,
            'impact_summary': {
                'text': self.impact_summary.text,
                'type': self.impact_summary.impact_type,
            } if self.impact_summary else None,
            'attention_band': self.attention_band.value,
            'priority_rank': self.priority_rank,
            'priority_band': self.priority_band.value,
            'bottleneck_state': self.bottleneck_state.value,
            'escalation_recommended': self.escalation_recommended,
            'blocker_key': self.blocker_key,
            'blocker_label': self.blocker_label,
            'waiting_days': self.waiting_days,
            'open_signal_count': self.open_signal_count,
            'assessment_status': self.assessment_status,
            'placement_status': self.placement_status,
            'provider_response_status': self.provider_response_status,
            'sla_state': self.sla_state,
            'is_urgent': self.is_urgent,
            'is_stalled': self.is_stalled,
            'requires_action': self.requires_action,
            'computed_at': self.computed_at.isoformat() if self.computed_at else None,
        }


# =========================================================================
# Decision Builder
# =========================================================================

class OperationalDecisionBuilder:
    """
    Builds complete OperationalDecision from case data.
    
    This is the centralized logic that computes all 6 fields consistently.
    Used by all pages. No duplication.
    """
    
    # Constants
    PRIORITY_URGENCY_WEIGHT = {
        CaseIntakeProcess.Urgency.CRISIS: 400,
        CaseIntakeProcess.Urgency.HIGH: 300,
        CaseIntakeProcess.Urgency.MEDIUM: 200,
        CaseIntakeProcess.Urgency.LOW: 100,
    }
    
    WAITING_THRESHOLD_DAYS = 7
    STAGNATION_THRESHOLD_DAYS = 21
    
    @staticmethod
    def build_for_intake(intake: CaseIntakeProcess) -> OperationalDecision:
        """
        Build complete decision for a single intake (case).
        
        This is the main entry point. Orchestrates all sub-decisions.
        
        Args:
            intake: CaseIntakeProcess instance (fully loaded with related data)
            
        Returns:
            Complete OperationalDecision with all 6 fields populated
        """
        now = django_timezone.now()
        today = now.date()
        
        # Load related data
        assessment = getattr(intake, 'case_assessment', None)
        placement = intake.indications.order_by('-updated_at').first()
        open_signals = list(CareSignal.objects.filter(
            due_diligence_process=intake,
            status__in=[CareSignal.SignalStatus.OPEN, CareSignal.SignalStatus.IN_PROGRESS],
        ).order_by('-risk_level', '-updated_at')[:10])
        
        # Compute waiting days
        waiting_days = max((today - intake.updated_at.date()).days, 0)
        
        # === DECISION 1: BOTTLENECK STATE ===
        bottleneck_state = OperationalDecisionBuilder._determine_bottleneck_state(
            intake, assessment, placement, open_signals
        )
        
        # === DECISION 2: RECOMMENDED ACTION ===
        recommended_action = OperationalDecisionBuilder._determine_recommended_action(
            intake, assessment, placement, bottleneck_state, open_signals
        )
        
        # === DECISION 3: IMPACT SUMMARY ===
        impact_summary = OperationalDecisionBuilder._determine_impact_summary(recommended_action)
        
        # === DECISION 4: ATTENTION BAND + Flags ===
        attention_band, is_urgent, requires_action = OperationalDecisionBuilder._determine_attention_band(
            intake, assessment, placement, bottleneck_state, waiting_days, open_signals
        )
        
        # === DECISION 5: PRIORITY RANK ===
        priority_rank, priority_band = OperationalDecisionBuilder._determine_priority_rank(
            intake, assessment, waiting_days, open_signals, attention_band, bottleneck_state
        )
        
        # === DECISION 6: ESCALATION RECOMMENDED ===
        escalation_recommended = OperationalDecisionBuilder._determine_escalation_recommended(
            intake, placement, open_signals
        )
        
        # === BLOCKERS & STATUS ===
        blocker_key, blocker_label = OperationalDecisionBuilder._determine_blocker(
            intake, assessment, placement, bottleneck_state, open_signals
        )
        
        is_stalled = (
            bottleneck_state != BottleneckState.NONE and
            attention_band in [AttentionBandLevel.NOW, AttentionBandLevel.TODAY]
        )
        
        # SLA state (if placement exists)
        sla_state = None
        if placement:
            sla_info = calculate_provider_response_sla(placement, now=now)
            sla_state = sla_info.get('sla_state')
        
        # Build complete decision
        return OperationalDecision(
            case_id=intake.pk,
            case_title=intake.title,
            case_status=intake.status,
            urgency=intake.urgency,
            recommended_action=recommended_action,
            impact_summary=impact_summary,
            attention_band=attention_band,
            priority_rank=priority_rank,
            priority_band=priority_band,
            bottleneck_state=bottleneck_state,
            escalation_recommended=escalation_recommended,
            blocker_key=blocker_key,
            blocker_label=blocker_label,
            waiting_days=waiting_days,
            open_signal_count=len(open_signals),
            assessment_status=assessment.assessment_status if assessment else None,
            placement_status=placement.status if placement else None,
            provider_response_status=placement.provider_response_status if placement else None,
            sla_state=sla_state,
            is_urgent=is_urgent,
            is_stalled=is_stalled,
            requires_action=requires_action,
            computed_at=now,
        )
    
    # ===================== SUB-DECISIONS =====================
    
    @staticmethod
    def _determine_bottleneck_state(
        intake: CaseIntakeProcess,
        assessment: Optional[CaseAssessment],
        placement: Optional[PlacementRequest],
        open_signals: List[CareSignal],
    ) -> BottleneckState:
        """
        Determine which flow stage is blocked (if any).
        
        Priority: matching > placement > none
        """
        S = CaseIntakeProcess.ProcessStatus
        
        # No match found
        if intake.status in [S.MATCHING, S.DECISION]:
            if placement is None or not placement.selected_provider_id:
                no_match_signal = any(
                    s.signal_type == CareSignal.SignalType.NO_MATCH
                    and s.status in [CareSignal.SignalStatus.OPEN, CareSignal.SignalStatus.IN_PROGRESS]
                    for s in open_signals
                )
                if no_match_signal:
                    return BottleneckState.MATCHING
        
        # Placement stalled
        if placement:
            if placement.status in [
                PlacementRequest.Status.DRAFT,
                PlacementRequest.Status.NEEDS_INFO,
            ]:
                return BottleneckState.PLACEMENT
            if placement.provider_response_status in [
                PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
                PlacementRequest.ProviderResponseStatus.WAITLIST,
                PlacementRequest.ProviderResponseStatus.PENDING,
            ]:
                return BottleneckState.PLACEMENT
        
        return BottleneckState.NONE
    
    @staticmethod
    def _determine_recommended_action(
        intake: CaseIntakeProcess,
        assessment: Optional[CaseAssessment],
        placement: Optional[PlacementRequest],
        bottleneck_state: BottleneckState,
        open_signals: List[CareSignal],
    ) -> Optional[RecommendedAction]:
        """Determine the recommended next action based on case state."""
        S = CaseIntakeProcess.ProcessStatus
        AS = CaseAssessment.AssessmentStatus
        
        # Case needs matching
        if intake.status in [S.INTAKE]:
            return RecommendedAction(
                label="Start matching",
                reason="Kies een passende aanbieder via matching",
                action_type="assign",
                target_url=reverse('careon:matching_dashboard') + f"?intake={intake.pk}",
            )
        
        # No match found
        if intake.status in [S.MATCHING, S.DECISION]:
            if placement is None or not placement.selected_provider_id:
                return RecommendedAction(
                    label="Zoek aanbieder",
                    reason="Geen passende aanbieder gevonden",
                    action_type="assign",
                    target_url=reverse('careon:matching_dashboard') + f"?intake={intake.pk}",
                )
        
        # Placement stalled
        if placement and placement.provider_response_status in [
            PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
            PlacementRequest.ProviderResponseStatus.PENDING,
        ]:
            return RecommendedAction(
                label="Herstart matching",
                reason="Huidige aanbieder reageert niet of heeft geen capaciteit",
                action_type="rematch",
                target_url=reverse('careon:case_detail', args=[intake.pk]) + "?tab=plaatsing",
            )
        
        # Open escalation
        escalation_signal = next(
            (s for s in open_signals
             if s.signal_type == CareSignal.SignalType.ESCALATION
             and s.status in [CareSignal.SignalStatus.OPEN]),
            None
        )
        if escalation_signal:
            return RecommendedAction(
                label="Escalatie aanbevolen",
                reason="Open escalatiesignaal vereist aandacht",
                action_type="escalate",
                target_url=reverse('careon:signal_update', args=[escalation_signal.pk]),
            )
        
        # Default: monitor
        return RecommendedAction(
            label="Monitor voortgang",
            reason="Case beweegt door flow",
            action_type="monitor",
            target_url=reverse('careon:case_detail', args=[intake.pk]),
        )
    
    @staticmethod
    def _determine_impact_summary(
        recommended_action: Optional[RecommendedAction]
    ) -> Optional[ImpactSummary]:
        """Determine impact of recommended action (outcome-focused)."""
        if not recommended_action:
            return None
        
        # Map action type to impact language
        action_impacts = {
            "review": {
                "text": "Ontgrendelt vervolgstap",
                "type": "accelerating",
            },
            "assign": {
                "text": "Maakt plaatsing mogelijk",
                "type": "accelerating",
            },
            "rematch": {
                "text": "Vergroot kans op match",
                "type": "accelerating",
            },
            "escalate": {
                "text": "Voorkomt verdere vertraging",
                "type": "protective",
            },
            "monitor": {
                "text": "Houdt zaak op koers",
                "type": "positive",
            },
        }
        
        impact_config = action_impacts.get(recommended_action.action_type, {
            "text": "Verbetert situatie",
            "type": "positive",
        })
        
        return ImpactSummary(
            text=impact_config["text"],
            impact_type=impact_config["type"],
        )
    
    @staticmethod
    def _determine_attention_band(
        intake: CaseIntakeProcess,
        assessment: Optional[CaseAssessment],
        placement: Optional[PlacementRequest],
        bottleneck_state: BottleneckState,
        waiting_days: int,
        open_signals: List[CareSignal],
    ) -> tuple[AttentionBandLevel, bool, bool]:
        """
        Determine attention level (app-wide urgency vocabulary).
        
        Returns:
            (attention_band, is_urgent, requires_action)
        """
        S = CaseIntakeProcess.ProcessStatus
        
        is_urgent = intake.urgency in [
            CaseIntakeProcess.Urgency.HIGH,
            CaseIntakeProcess.Urgency.CRISIS,
        ]
        
        has_escalation = any(
            s.signal_type == CareSignal.SignalType.ESCALATION
            and s.status in [CareSignal.SignalStatus.OPEN]
            for s in open_signals
        )
        
        has_critical_signal = any(
            s.risk_level == CareSignal.RiskLevel.CRITICAL
            for s in open_signals
        )
        
        # === NOW: Immediate action required
        if has_escalation or has_critical_signal:
            return AttentionBandLevel.NOW, True, True
        
        # Crisis urgency always requires immediate attention
        if intake.urgency == CaseIntakeProcess.Urgency.CRISIS:
            return AttentionBandLevel.NOW, True, True
        
        if bottleneck_state == BottleneckState.MATCHING and is_urgent:
            return AttentionBandLevel.NOW, True, True
        
        if waiting_days > OperationalDecisionBuilder.STAGNATION_THRESHOLD_DAYS:
            return AttentionBandLevel.NOW, True, True
        
        # === TODAY: Schedule today
        if bottleneck_state != BottleneckState.NONE:
            return AttentionBandLevel.TODAY, is_urgent, True
        
        if is_urgent and intake.status in [S.INTAKE, S.MATCHING]:
            return AttentionBandLevel.TODAY, True, True
        
        if waiting_days >= OperationalDecisionBuilder.WAITING_THRESHOLD_DAYS:
            return AttentionBandLevel.TODAY, False, True
        
        # === MONITOR: Watch for changes
        if placement and placement.provider_response_status in [
            PlacementRequest.ProviderResponseStatus.PENDING,
            PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
        ]:
            return AttentionBandLevel.MONITOR, False, False
        
        # === WAITING: External party
        if placement and placement.status in [PlacementRequest.Status.APPROVED]:
            return AttentionBandLevel.WAITING, False, False
        
        # Default
        if is_urgent:
            return AttentionBandLevel.TODAY, True, False
        
        return AttentionBandLevel.MONITOR, False, False
    
    @staticmethod
    def _determine_priority_rank(
        intake: CaseIntakeProcess,
        assessment: Optional[CaseAssessment],
        waiting_days: int,
        open_signals: List[CareSignal],
        attention_band: AttentionBandLevel,
        bottleneck_state: BottleneckState,
    ) -> tuple[int, PriorityRankBand]:
        """
        Determine numeric priority rank (1-100, lower is higher priority).
        
        Returns:
            (rank_int, rank_band_enum)
        """
        rank = 50  # Default middle
        
        # Base urgency weight
        urgency_weight = OperationalDecisionBuilder.PRIORITY_URGENCY_WEIGHT.get(
            intake.urgency, 100
        )
        
        # Convert weight to rank (higher weight = lower rank number)
        if urgency_weight >= 400:
            rank = 5
        elif urgency_weight >= 300:
            rank = 10
        elif urgency_weight >= 200:
            rank = 25
        else:
            rank = 40
        
        # Adjust by waiting days
        rank += min(waiting_days, 30)
        
        # Boost if bottleneck
        if bottleneck_state != BottleneckState.NONE:
            rank = max(1, rank - 15)
        
        # Boost if escalation
        if any(s.signal_type == CareSignal.SignalType.ESCALATION for s in open_signals):
            rank = max(1, rank - 20)
        
        # Determine band
        if rank <= 5:
            band = PriorityRankBand.FIRST
        elif rank <= 15:
            band = PriorityRankBand.SOON
        elif rank <= 30:
            band = PriorityRankBand.MONITOR
        elif rank <= 50:
            band = PriorityRankBand.WAITING
        else:
            band = PriorityRankBand.ESCALATE
        
        return min(rank, 100), band
    
    @staticmethod
    def _determine_escalation_recommended(
        intake: CaseIntakeProcess,
        placement: Optional[PlacementRequest],
        open_signals: List[CareSignal],
    ) -> bool:
        """Determine if escalation is recommended."""
        # Existing escalation signal
        if any(
            s.signal_type == CareSignal.SignalType.ESCALATION
            and s.status in [CareSignal.SignalStatus.OPEN]
            for s in open_signals
        ):
            return True
        
        # Critical risk signals
        if any(s.risk_level == CareSignal.RiskLevel.CRITICAL for s in open_signals):
            return True
        
        # Placement stalled beyond recovery
        if placement and placement.provider_response_status in [
            PlacementRequest.ProviderResponseStatus.REJECTED,
            PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
        ]:
            # If multiple reminders sent, escalation recommended
            if placement.provider_response_last_reminder_at:
                reminders = (django_timezone.now() - placement.provider_response_last_reminder_at).days
                if reminders > 7:
                    return True
        
        return False
    
    @staticmethod
    def _determine_blocker(
        intake: CaseIntakeProcess,
        assessment: Optional[CaseAssessment],
        placement: Optional[PlacementRequest],
        bottleneck_state: BottleneckState,
        open_signals: List[CareSignal],
    ) -> tuple[Optional[str], Optional[str]]:
        """Determine the dominant blocker (one per case)."""
        if bottleneck_state == BottleneckState.MATCHING:
            return "no_match", "Geen passende aanbieder"
        
        if bottleneck_state == BottleneckState.PLACEMENT:
            return "placement_stalled", "Providerreactie uitgebleven"
        
        # No specific bottleneck, check for high signals
        for signal in open_signals:
            if signal.signal_type == CareSignal.SignalType.ESCALATION:
                return "escalation_open", "Escalatie open"
        
        return None, None


# =========================================================================
# Public API
# =========================================================================

def build_operational_decision_for_intake(intake_id: int) -> Optional[OperationalDecision]:
    """
    Build complete operational decision for a single case.
    
    This is the primary entry point for all pages.
    
    Args:
        intake_id: Primary key of CaseIntakeProcess
        
    Returns:
        OperationalDecision with all 6 fields, or None if intake not found
    """
    try:
        intake = CaseIntakeProcess.objects.select_related(
            'case_assessment',
            'case_coordinator',
            'care_category_main',
            'preferred_region',
        ).prefetch_related(
            'indications',
        ).get(pk=intake_id)
    except CaseIntakeProcess.DoesNotExist:
        return None
    
    return OperationalDecisionBuilder.build_for_intake(intake)


def build_operational_decisions_for_organization(org_id: int) -> List[OperationalDecision]:
    """
    Build operational decisions for all active cases in an organization.
    
    Used by Regiekamer and Reports.
    
    Args:
        org_id: Organization ID
        
    Returns:
        List of OperationalDecision objects
    """
    intakes = CaseIntakeProcess.objects.filter(
        organization_id=org_id,
        status__in=[
            CaseIntakeProcess.ProcessStatus.INTAKE,
            CaseIntakeProcess.ProcessStatus.MATCHING,
            CaseIntakeProcess.ProcessStatus.DECISION,
            CaseIntakeProcess.ProcessStatus.ON_HOLD,
        ],
    ).select_related(
        'case_assessment',
        'case_coordinator',
        'care_category_main',
        'preferred_region',
    ).prefetch_related(
        'indications',
    ).order_by('-updated_at')
    
    decisions = []
    for intake in intakes:
        try:
            decision = OperationalDecisionBuilder.build_for_intake(intake)
            decisions.append(decision)
        except Exception:
            # Skip cases with data issues, log in production
            pass
    
    return decisions
