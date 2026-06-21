"""Brute-force protection for login surfaces (SPA JSON + Django form login)."""
from __future__ import annotations

import hashlib
import logging
from typing import Optional, Tuple

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


def _client_ip(request) -> str:
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown') or 'unknown'


def _username_fingerprint(username: str) -> str:
    normalized = (username or '').strip().lower()
    if not normalized:
        return 'empty'
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()[:16]


def _attempt_key(request, username: str) -> str:
    return f"auth:login:attempts:{_client_ip(request)}:{_username_fingerprint(username)}"


def _lockout_key(request, username: str) -> str:
    return f"auth:login:lockout:{_client_ip(request)}:{_username_fingerprint(username)}"


def _settings_int(name: str, default: int) -> int:
    return int(getattr(settings, name, default))


def login_lockout_remaining(request, username: str = '') -> int:
    """Seconds until lockout expires; 0 when not locked."""
    try:
        ttl = cache.ttl(_lockout_key(request, username))
    except Exception:
        return 0
    if ttl is None or ttl < 0:
        return 0
    return int(ttl)


def is_login_locked(request, username: str = '') -> bool:
    return login_lockout_remaining(request, username) > 0


def check_login_allowed(request, username: str = '') -> Tuple[bool, int]:
    """
    Returns (allowed, retry_after_seconds).
    Lockout is keyed by client IP + username fingerprint.
    """
    if not _settings_int('AUTH_LOGIN_RATE_LIMIT_ENABLED', 1):
        return True, 0

    remaining = login_lockout_remaining(request, username)
    if remaining > 0:
        return False, remaining

    max_attempts = _settings_int('AUTH_LOGIN_MAX_ATTEMPTS', 5)
    window = _settings_int('AUTH_LOGIN_ATTEMPT_WINDOW_SECONDS', 900)
    attempt_key = _attempt_key(request, username)

    try:
        attempts = cache.get(attempt_key, 0)
    except Exception:
        logger.exception('auth_rate_limit_cache_read_failed')
        return True, 0

    if attempts >= max_attempts:
        lockout_seconds = _settings_int('AUTH_LOGIN_LOCKOUT_SECONDS', 900)
        try:
            cache.set(_lockout_key(request, username), 1, lockout_seconds)
        except Exception:
            logger.exception('auth_rate_limit_lockout_write_failed')
        return False, lockout_seconds

    return True, window


def record_failed_login(request, username: str = '') -> None:
    max_attempts = _settings_int('AUTH_LOGIN_MAX_ATTEMPTS', 5)
    window = _settings_int('AUTH_LOGIN_ATTEMPT_WINDOW_SECONDS', 900)
    lockout_seconds = _settings_int('AUTH_LOGIN_LOCKOUT_SECONDS', 900)
    attempt_key = _attempt_key(request, username)

    try:
        attempts = cache.get(attempt_key, 0) + 1
        cache.set(attempt_key, attempts, window)
        if attempts >= max_attempts:
            cache.set(_lockout_key(request, username), 1, lockout_seconds)
            logger.warning(
                'auth_login_lockout ip=%s user_fp=%s attempts=%d',
                _client_ip(request),
                _username_fingerprint(username),
                attempts,
            )
    except Exception:
        logger.exception('auth_rate_limit_record_failed')


def clear_login_attempts(request, username: str = '') -> None:
    try:
        cache.delete(_attempt_key(request, username))
        cache.delete(_lockout_key(request, username))
    except Exception:
        logger.exception('auth_rate_limit_clear_failed')


def lockout_user_message(retry_after: int) -> str:
    minutes = max(1, retry_after // 60)
    return (
        f'Te veel mislukte inlogpogingen. Probeer het over {minutes} '
        f'minute{"n" if minutes != 1 else ""} opnieuw.'
    )
