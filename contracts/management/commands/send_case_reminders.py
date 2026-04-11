from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.urls import reverse
from django.utils import timezone

from contracts.models import CareCase, Notification, OrganizationMembership


class Command(BaseCommand):
    help = 'Send reminder notifications for upcoming case review and renewal dates.'

    def handle(self, *args, **options):
        today = timezone.localdate()
        created_count = 0

        case_records = (
            CareCase.objects
            .filter(
                organization__is_active=True,
                status__in=[CareCase.Status.ACTIVE, CareCase.Status.APPROVED],
            )
            .filter(Q(end_date__isnull=False) | Q(renewal_date__isnull=False))
            .select_related(
                'organization',
                'created_by',
                'matter__responsible_care_coordinator',
                'client__responsible_coordinator',
            )
        )

        for case_record in case_records:
            events = []
            if case_record.end_date:
                days_until_end = (case_record.end_date - today).days
                if 0 <= days_until_end <= 30 and days_until_end in {30, 14, 7, 3, 1, 0}:
                    events.append(('Einddatum', case_record.end_date, days_until_end))

            if case_record.renewal_date:
                days_until_renewal = (case_record.renewal_date - today).days
                if 0 <= days_until_renewal <= 45 and days_until_renewal in {45, 30, 14, 7, 3, 1, 0}:
                    events.append(('Herbeoordeling', case_record.renewal_date, days_until_renewal))

            if not events:
                continue

            recipients = set()
            configuration = case_record.configuration
            if case_record.created_by_id:
                recipients.add(case_record.created_by)
            if configuration and configuration.responsible_coordinator_id:
                recipients.add(configuration.responsible_coordinator)
            if case_record.client and case_record.client.responsible_coordinator_id:
                recipients.add(case_record.client.responsible_coordinator)

            admins = (
                OrganizationMembership.objects
                .filter(
                    organization=case_record.organization,
                    is_active=True,
                    role__in=[OrganizationMembership.Role.OWNER, OrganizationMembership.Role.ADMIN],
                )
                .select_related('user')
            )
            for membership in admins:
                recipients.add(membership.user)

            case_link = reverse('careon:case_detail', kwargs={'pk': case_record.id})

            for event_name, event_date, days_remaining in events:
                for recipient in recipients:
                    title = f'{event_name} herinnering: {case_record.title} ({days_remaining}d)'
                    exists = Notification.objects.filter(
                        recipient=recipient,
                        notification_type=Notification.NotificationType.DEADLINE,
                        title=title,
                        link=case_link,
                        created_at__date=today,
                    ).exists()
                    if exists:
                        continue

                    Notification.objects.create(
                        recipient=recipient,
                        notification_type=Notification.NotificationType.DEADLINE,
                        title=title,
                        message=(
                            f'{case_record.title} heeft een aankomende {event_name.lower()} op '
                            f'{event_date.isoformat()} ({days_remaining} dag(en) resterend).'
                        ),
                        link=case_link,
                    )
                    created_count += 1

        self.stdout.write(self.style.SUCCESS(f'Created {created_count} reminder notification(s).'))
