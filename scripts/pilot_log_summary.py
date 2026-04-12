#!/usr/bin/env python3
"""Summarize new pilot warning events from the HTTPS dev log.

This reads only new lines since the last run by default, so it fits the
day-3/day-4 pilot cadence without requiring timestamps in the log format.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
import argparse
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOG_PATH = ROOT / 'logs' / 'dev_https.log'
DEFAULT_STATE_PATH = ROOT / 'logs' / '.pilot_log_summary.state'
EVENT_RE = re.compile(
    r'pilot\.(?P<category>[a-z_]+)\s+user=(?P<user>[^\s]+)\s+path=(?P<path>[^\s]+)\s+detail=(?P<detail>.*)$'
)


@dataclass(frozen=True)
class Event:
    category: str
    user: str
    path: str
    detail: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Summarize new pilot warning events from a Careon log file.'
    )
    parser.add_argument(
        'log_path',
        nargs='?',
        default=str(DEFAULT_LOG_PATH),
        help=f'Path to the log file to scan. Default: {DEFAULT_LOG_PATH}',
    )
    parser.add_argument(
        '--state-file',
        default=str(DEFAULT_STATE_PATH),
        help=f'Offset state file. Default: {DEFAULT_STATE_PATH}',
    )
    parser.add_argument(
        '--top',
        type=int,
        default=5,
        help='Number of top repeated routes/users to show per category. Default: 5',
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Scan the full log file instead of only new lines since the last run.',
    )
    parser.add_argument(
        '--reset-state',
        action='store_true',
        help='Ignore any saved offset and read from the start of the file.',
    )
    return parser.parse_args()


def load_offset(state_path: Path) -> int:
    try:
        raw = state_path.read_text(encoding='utf-8').strip()
    except FileNotFoundError:
        return 0
    except OSError:
        return 0

    try:
        return int(raw)
    except ValueError:
        return 0


def save_offset(state_path: Path, offset: int) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(str(offset), encoding='utf-8')


def read_chunk(log_path: Path, *, full_scan: bool, reset_state: bool, state_path: Path) -> tuple[list[str], int]:
    if not log_path.exists():
        raise FileNotFoundError(f'Log file not found: {log_path}')

    start_offset = 0 if full_scan or reset_state else load_offset(state_path)
    file_size = log_path.stat().st_size
    if start_offset > file_size:
        start_offset = 0

    with log_path.open('r', encoding='utf-8', errors='replace') as handle:
        handle.seek(start_offset)
        lines = handle.readlines()
        end_offset = handle.tell()

    return lines, end_offset


def parse_events(lines: list[str]) -> list[Event]:
    events: list[Event] = []
    for line in lines:
        match = EVENT_RE.search(line.strip())
        if not match:
            continue
        events.append(
            Event(
                category=match.group('category'),
                user=match.group('user'),
                path=match.group('path'),
                detail=match.group('detail'),
            )
        )
    return events


def print_summary(events: list[Event], *, top: int, log_path: Path, full_scan: bool) -> None:
    scope = 'full log' if full_scan else 'new log lines'
    print(f'Pilot warning summary for {log_path} ({scope})')
    print(f'Total pilot events: {len(events)}')

    if not events:
        print('No pilot warning events found.')
        return

    by_category = Counter(event.category for event in events)
    by_category_route: dict[str, Counter[str]] = defaultdict(Counter)
    by_category_user: dict[str, Counter[str]] = defaultdict(Counter)

    for event in events:
        by_category_route[event.category][event.path] += 1
        by_category_user[event.category][event.user] += 1

    print('')
    print('By category:')
    for category, count in by_category.most_common():
        print(f'- {category}: {count}')
        for route, route_count in by_category_route[category].most_common(top):
            print(f'  route {route}: {route_count}')
        for user, user_count in by_category_user[category].most_common(top):
            print(f'  user {user}: {user_count}')

    repeated_routes = [
        (category, route, count)
        for category, routes in by_category_route.items()
        for route, count in routes.items()
        if count > 1
    ]
    if repeated_routes:
        print('')
        print('Repeated route patterns to review:')
        for category, route, count in sorted(repeated_routes, key=lambda item: (-item[2], item[0], item[1])):
            print(f'- {category}: {route} ({count}x)')


def main() -> int:
    args = parse_args()
    log_path = Path(args.log_path)
    state_path = Path(args.state_file)
    try:
        lines, end_offset = read_chunk(
            log_path,
            full_scan=args.all,
            reset_state=args.reset_state,
            state_path=state_path,
        )
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    events = parse_events(lines)
    print_summary(events, top=args.top, log_path=log_path, full_scan=args.all or args.reset_state)

    if not args.all:
        save_offset(state_path, end_offset)
    return 0


if __name__ == '__main__':
    sys.exit(main())