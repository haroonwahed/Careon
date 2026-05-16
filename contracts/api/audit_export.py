"""
Org- and case-scoped audit / dispute exports for compliance and escalation review.
"""
from __future__ import annotations

import csv
import io
from datetime import date, datetime, timezone

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import HttpResponse, JsonResponse

from contracts.middleware import log_action
from contracts.models import (
    AuditLog,
    CareCase,
    CaseAssessment,
    CaseDecisionLog,
    CaseIntakeProcess,
    CaseTimelineEvent,
    PlacementRequest,
)
from contracts.case_timeline import serialize_timeline_events_for_api

User = get_user_model()


def _org_audit_queryset(*, organization):
    if not organization:
        return AuditLog.objects.none()
    org_user_ids = list(
        User.objects.filter(organization_memberships__organization=organization).values_list('id', flat=True)
    )
    return AuditLog.objects.select_related('user').filter(user_id__in=org_user_ids)


def _case_related_audit_queryset(*, organization, case: CareCase, intake: CaseIntakeProcess | None):
    base = _org_audit_queryset(organization=organization)
    filters = Q(model_name='CareCase', object_id=case.pk)
    if intake:
        filters |= Q(model_name='CaseIntakeProcess', object_id=intake.pk)
        assessment = getattr(intake, 'case_assessment', None)
        if assessment is not None:
            filters |= Q(model_name='CaseAssessment', object_id=assessment.pk)
        placement_ids = list(
            PlacementRequest.objects.filter(due_diligence_process=intake).values_list('pk', flat=True)
        )
        if placement_ids:
            filters |= Q(model_name='PlacementRequest', object_id__in=placement_ids)
    return base.filter(filters)


def _audit_row(entry: AuditLog) -> list:
    event = ''
    if isinstance(entry.changes, dict):
        event = str(entry.changes.get('event', '') or '')
    return [
        entry.timestamp.isoformat(),
        (entry.user.get_full_name() or entry.user.username) if entry.user else 'Systeem',
        entry.action,
        entry.model_name,
        str(entry.object_id or ''),
        entry.object_repr,
        event,
        entry.ip_address or '',
    ]


def _write_audit_csv(entries, *, filename_prefix: str) -> HttpResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(['timestamp', 'user', 'action', 'model_name', 'object_id', 'object_repr', 'event', 'ip_address'])
    for entry in entries:
        writer.writerow(_audit_row(entry))
    response = HttpResponse(buffer.getvalue(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = (
        f'attachment; filename="{filename_prefix}-{date.today().isoformat()}.csv"'
    )
    return response


def build_audit_log_export(*, request, organization, actor_role: str, provider_forbidden: bool = True):
    from contracts.workflow_state_machine import WorkflowRole

    if provider_forbidden and actor_role == WorkflowRole.ZORGAANBIEDER:
        return JsonResponse(
            {'ok': False, 'error': 'Auditlog-export is niet beschikbaar voor deze rol.'},
            status=403,
        )
    fmt = (request.GET.get('format') or 'csv').strip().lower()
    qs = _org_audit_queryset(organization=organization).order_by('-timestamp', '-id')
    q = request.GET.get('q', '').strip()
    if q:
        qs = qs.filter(Q(model_name__icontains=q) | Q(object_repr__icontains=q))
    limit = min(int(request.GET.get('limit', 5000)), 10000)
    entries = list(qs[:limit])
    log_action(
        request.user,
        AuditLog.Action.EXPORT,
        'AuditLog',
        object_repr=f'org export ({len(entries)} rows)',
        changes={'format': fmt, 'row_count': len(entries)},
        request=request,
    )
    if fmt == 'json':
        return JsonResponse({
            'entries': [
                {
                    'timestamp': e.timestamp.isoformat(),
                    'action': e.action,
                    'modelName': e.model_name,
                    'objectId': e.object_id,
                    'objectRepr': e.object_repr,
                    'userName': (e.user.get_full_name() if e.user else 'Systeem'),
                    'changes': e.changes,
                }
                for e in entries
            ],
            'rowCount': len(entries),
        })
    return _write_audit_csv(entries, filename_prefix='careon-audit-log')


def build_case_dispute_export(*, request, organization, case: CareCase, intake: CaseIntakeProcess | None):
    timeline_qs = CaseTimelineEvent.objects.filter(
        organization=organization,
        care_case=case,
    ).order_by('occurred_at', 'id')
    events = serialize_timeline_events_for_api(timeline_qs)

    decision_logs = []
    if intake:
        for row in CaseDecisionLog.objects.filter(case=intake).order_by('-timestamp', '-id')[:500]:
            decision_logs.append({
                'createdAt': row.timestamp.isoformat() if row.timestamp else None,
                'eventType': row.event_type,
                'actorKind': row.actor_kind,
                'summary': row.user_action or row.optional_reason or '',
                'metadata': row.recommendation_context or {},
            })

    audit_entries = list(
        _case_related_audit_queryset(organization=organization, case=case, intake=intake).order_by('-timestamp')[:500]
    )
    log_action(
        request.user,
        AuditLog.Action.EXPORT,
        'CareCase',
        object_id=case.pk,
        object_repr=f'dispute export casus {case.pk}',
        changes={'timeline_count': len(events), 'audit_count': len(audit_entries)},
        request=request,
    )

    fmt = (request.GET.get('format') or 'json').strip().lower()
    exported_at = datetime.now(timezone.utc).isoformat()
    if fmt == 'csv':
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(['section', 'timestamp', 'type', 'summary', 'detail'])
        for ev in events:
            writer.writerow([
                'timeline',
                ev.get('occurred_at', ''),
                ev.get('event_type', ''),
                ev.get('summary', ''),
                ev.get('source', ''),
            ])
        for dl in decision_logs:
            writer.writerow([
                'decision',
                dl.get('createdAt', ''),
                dl.get('eventType', ''),
                dl.get('summary', ''),
                '',
            ])
        for entry in audit_entries:
            writer.writerow(['audit', *_audit_row(entry)])
        response = HttpResponse(buffer.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = (
            f'attachment; filename="careon-dispute-casus-{case.pk}-{date.today().isoformat()}.csv"'
        )
        return response

    return JsonResponse({
        'exportedAt': exported_at,
        'caseId': str(case.pk),
        'caseTitle': case.title,
        'workflowState': getattr(intake, 'workflow_state', None) if intake else None,
        'timelineEvents': events,
        'decisionLog': decision_logs,
        'auditEntries': [
            {
                'timestamp': e.timestamp.isoformat(),
                'action': e.action,
                'modelName': e.model_name,
                'objectId': e.object_id,
                'objectRepr': e.object_repr,
                'userName': (e.user.get_full_name() if e.user else 'Systeem'),
                'changes': e.changes,
            }
            for e in audit_entries
        ],
    })
