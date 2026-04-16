import json
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from contracts.decision_quality_workflow import (
    build_weekly_decision_quality_review_packet,
    get_top_decision_quality_reasons,
    get_weekly_decision_quality_summary,
    get_weekly_review_completion_stats,
)


def _json_safe(value: Any) -> Any:
    """Recursively convert values into JSON-serializable primitives."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]
    return value


def _provider_from_recommendation(recommendation_snapshot: Dict[str, Any]) -> str:
    recommendation = recommendation_snapshot.get('recommendation') or {}
    if isinstance(recommendation, dict):
        provider_id = recommendation.get('provider_id')
        if provider_id is not None:
            return f'provider {provider_id}'
    return 'unknown recommendation'


def _actual_decision_text(actual_decision_snapshot: Dict[str, Any]) -> str:
    latest_event = actual_decision_snapshot.get('latest_event') or {}
    if isinstance(latest_event, dict):
        if latest_event.get('summary'):
            return str(latest_event['summary'])
        if latest_event.get('event_type'):
            return str(latest_event['event_type'])
    return 'no decision events'


def _compact_case(case_row: Dict[str, Any]) -> Dict[str, Any]:
    case_summary = case_row.get('case_summary') or {}
    outcome = case_row.get('outcome') or {}
    review_status = case_row.get('review_status') or {}
    override = case_row.get('override') or {}

    recommendation_text = _provider_from_recommendation(case_row.get('recommendation_snapshot') or {})
    actual_text = _actual_decision_text(case_row.get('actual_decision_snapshot') or {})

    return {
        'case_id': case_row.get('case_id'),
        'reviewed_this_week': bool(review_status.get('reviewed_this_week')),
        'override_present': bool(override.get('present')),
        'current_outcome': outcome.get('placement_result') or case_summary.get('status') or 'unknown',
        'recommendation_vs_actual_summary': f'rec: {recommendation_text} | actual: {actual_text}',
    }


class Command(BaseCommand):
    help = 'Build weekly decision-quality review packet and summary for pilot operations.'

    def add_arguments(self, parser):
        parser.add_argument('--year', type=int, help='ISO year (defaults to current ISO year).')
        parser.add_argument('--week', type=int, help='ISO week number 1-53 (defaults to current ISO week).')
        parser.add_argument('--limit', type=int, help='Limit number of selected cases in output.')
        parser.add_argument('--json', action='store_true', dest='as_json', help='Print structured JSON to stdout.')
        parser.add_argument('--output', type=str, help='Optional file path to write structured JSON output.')
        parser.add_argument(
            '--include-reviewed',
            action='store_true',
            help='Include already-reviewed cases in selected case output.',
        )

    def handle(self, *args, **options):
        iso_now = timezone.localdate().isocalendar()
        year_option = options.get('year')
        week_option = options.get('week')
        year = int(iso_now.year if year_option is None else year_option)
        week = int(iso_now.week if week_option is None else week_option)
        limit = options.get('limit')
        as_json = bool(options.get('as_json'))
        output_path = options.get('output')
        include_reviewed = bool(options.get('include_reviewed'))

        self._validate_inputs(year=year, week=week, limit=limit)

        try:
            packet = build_weekly_decision_quality_review_packet(year, week)
            summary = get_weekly_decision_quality_summary(year, week)
            top_reasons = get_top_decision_quality_reasons(year, week)
            completion_stats = get_weekly_review_completion_stats(year, week)
        except Exception as exc:
            raise CommandError(f'Unable to build weekly decision review data: {exc}') from exc

        selected_cases = list(packet.get('cases', []))
        if not include_reviewed:
            selected_cases = [
                row for row in selected_cases
                if not bool((row.get('review_status') or {}).get('reviewed_this_week'))
            ]
        if limit is not None:
            selected_cases = selected_cases[:limit]

        compact_cases = [_compact_case(case_row) for case_row in selected_cases]

        payload = _json_safe({
            'year': year,
            'week': week,
            'summary': summary,
            'selected_cases': compact_cases,
            'top_reasons': top_reasons,
            'completion_stats': completion_stats,
        })

        if output_path:
            self._write_json_file(payload, output_path)
            self.stdout.write(self.style.SUCCESS(f'Wrote JSON export to {output_path}'))

        if as_json:
            self.stdout.write(json.dumps(payload, indent=2, sort_keys=True))
            return

        self._print_terminal_summary(
            year=year,
            week=week,
            packet=packet,
            summary=summary,
            top_reasons=top_reasons,
            completion_stats=completion_stats,
            selected_cases=compact_cases,
            include_reviewed=include_reviewed,
            limit=limit,
        )

    def _validate_inputs(self, *, year: int, week: int, limit: int | None) -> None:
        if year < 1:
            raise CommandError('Invalid --year: use a positive ISO year value.')
        if week < 1 or week > 53:
            raise CommandError('Invalid --week: use an ISO week between 1 and 53.')
        if limit is not None and limit < 1:
            raise CommandError('Invalid --limit: value must be 1 or greater.')

        try:
            date.fromisocalendar(year, week, 1)
        except ValueError as exc:
            raise CommandError(f'Invalid ISO year/week combination: {year}-W{week}.') from exc

    def _write_json_file(self, payload: Dict[str, Any], output_path: str) -> None:
        try:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding='utf-8')
        except OSError as exc:
            raise CommandError(f'Unable to write JSON output file: {exc}') from exc

    def _print_terminal_summary(
        self,
        *,
        year: int,
        week: int,
        packet: Dict[str, Any],
        summary: Dict[str, Any],
        top_reasons: Dict[str, List[Dict[str, Any]]],
        completion_stats: Dict[str, Any],
        selected_cases: List[Dict[str, Any]],
        include_reviewed: bool,
        limit: int | None,
    ) -> None:
        self.stdout.write(f'Weekly Decision Review - Week {week}, {year}')
        self.stdout.write(f"Window: {packet.get('week_start')} to {packet.get('week_end')}")
        self.stdout.write('')

        candidate_count = int(packet.get('candidate_count') or 0)
        reviewed_count = int(completion_stats.get('reviewed_candidate_case_count') or 0)
        unreviewed_count = int(completion_stats.get('candidate_not_yet_reviewed_count') or 0)

        self.stdout.write(f'Candidate cases: {candidate_count}')
        self.stdout.write(f'Reviewed candidate cases: {reviewed_count}')
        self.stdout.write(f'Unreviewed candidate cases: {unreviewed_count}')

        reviewed_case_count = int(summary.get('reviewed_case_count') or 0)
        self.stdout.write(f'Completed reviews this week: {reviewed_case_count}')
        self.stdout.write(
            f"Override frequency: {summary.get('override_count', 0)} "
            f"({summary.get('override_frequency_percent', 0.0)}%)"
        )
        self.stdout.write('')

        distribution = summary.get('quality_distribution') or {}
        if reviewed_case_count > 0 and distribution:
            self.stdout.write('Decision quality distribution:')
            for decision_quality, count in distribution.items():
                if count:
                    self.stdout.write(f'  - {decision_quality}: {count}')
        else:
            self.stdout.write('Decision quality distribution: no completed reviews yet')
        self.stdout.write('')

        self.stdout.write('Top reasons:')
        self._print_reason_block('user_correct', top_reasons.get('user_correct') or [])
        self._print_reason_block('both_suboptimal', top_reasons.get('both_suboptimal') or [])
        self.stdout.write('')

        if candidate_count == 0:
            self.stdout.write('No candidate cases found for this week. Nothing to review right now.')
            return

        self.stdout.write('Selected cases for meeting prep:')
        if not include_reviewed:
            self.stdout.write('  (already-reviewed cases are hidden; use --include-reviewed to include them)')
        if limit is not None:
            self.stdout.write(f'  (list limited to first {limit} selected case(s))')

        if not selected_cases:
            self.stdout.write('  - No cases matched the selected filters.')
            return

        for item in selected_cases:
            self.stdout.write(
                f"  - Case {item.get('case_id')} | reviewed={item.get('reviewed_this_week')} "
                f"| override={item.get('override_present')} | outcome={item.get('current_outcome')}"
            )
            self.stdout.write(f"    {item.get('recommendation_vs_actual_summary')}")

    def _print_reason_block(self, label: str, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            self.stdout.write(f'  - {label}: none')
            return

        top = rows[:3]
        formatted = ', '.join(f"{row.get('primary_reason')} ({row.get('count')})" for row in top)
        self.stdout.write(f'  - {label}: {formatted}')
