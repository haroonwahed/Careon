"""
Notification API — unread count and inbox list for the SPA bell.
"""
import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from contracts.models.governance import Notification

logger = logging.getLogger(__name__)


@login_required
@require_http_methods(["GET"])
def notifications_api(request):
    """Return unread count and recent notifications for the authenticated user."""
    qs = Notification.objects.filter(recipient=request.user).order_by('-created_at')
    unread_count = qs.filter(is_read=False).count()
    items = qs[:50]
    return JsonResponse({
        'unreadCount': unread_count,
        'notifications': [
            {
                'id': n.pk,
                'type': n.notification_type,
                'title': n.title,
                'message': n.message,
                'link': n.link,
                'isRead': n.is_read,
                'createdAt': n.created_at.isoformat(),
            }
            for n in items
        ],
    })


@login_required
@require_http_methods(["POST"])
def notifications_mark_read_api(request, notification_id: int):
    """Mark a single notification as read."""
    try:
        notification = Notification.objects.get(pk=notification_id, recipient=request.user)
    except Notification.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Not found.'}, status=404)
    notification.is_read = True
    notification.save(update_fields=['is_read'])
    return JsonResponse({'ok': True})


@login_required
@require_http_methods(["POST"])
def notifications_mark_all_read_api(request):
    """Mark all unread notifications as read."""
    count = Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return JsonResponse({'ok': True, 'marked': count})
