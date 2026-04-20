"""Management command: refresh_alerts

Regenerates Regiekamer alerts for all active cases in an organization.
Idempotent — safe to run repeatedly (e.g. via cron or post-deploy).

Usage:
    python manage.py refresh_alerts
    python manage.py refresh_alerts --org-id 1
"""

from django.core.management.base import BaseCommand

from contracts.alert_engine import generate_alerts_for_organization
from contracts.models import Organization


class Command(BaseCommand):
    help = 'Refresh Regiekamer alerts for all active cases in all (or one) organization(s).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--org-id',
            type=int,
            default=None,
            help='Only refresh alerts for this organization ID.',
        )

    def handle(self, *args, **options):
        org_id = options.get('org_id')

        if org_id:
            orgs = Organization.objects.filter(pk=org_id)
        else:
            orgs = Organization.objects.all()

        total_orgs = 0
        total_alerts = 0

        for org in orgs:
            try:
                summary = generate_alerts_for_organization(org.pk)
                count = summary.get('total_active_alerts', 0)
                total_alerts += count
                total_orgs += 1
                self.stdout.write(
                    f'  {org.name} (#{org.pk}): {count} actieve alertes'
                )
                by_type = summary.get('by_type', {})
                for alert_type, n in by_type.items():
                    self.stdout.write(f'    - {alert_type}: {n}')
            except Exception as exc:
                self.stdout.write(
                    self.style.WARNING(f'  Fout voor org #{org.pk}: {exc}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\nKlaar: {total_alerts} actieve alertes voor {total_orgs} organisatie(s).'
            )
        )
        self.stdout.write('Bekijk resultaten op /care/regiekamer/')
