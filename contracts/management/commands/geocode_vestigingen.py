from django.core.management.base import BaseCommand
from django.db.models import Q

from contracts.geocoding import apply_geocode_result, geocode_vestiging
from contracts.models import AanbiederVestiging


class Command(BaseCommand):
    help = 'Geocode active AanbiederVestiging records missing coordinates (PDOK default, Google fallback).'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=0, help='Max vestigingen to process (0 = all)')
        parser.add_argument('--force', action='store_true', help='Re-geocode even when coordinates exist')
        parser.add_argument('--prefer-google', action='store_true', help='Try Google Geocoding before PDOK')

    def handle(self, *args, **options):
        qs = AanbiederVestiging.objects.filter(is_active=True).order_by('id')
        if not options['force']:
            qs = qs.filter(Q(latitude__isnull=True) | Q(longitude__isnull=True))

        limit = options['limit']
        if limit:
            qs = qs[:limit]

        processed = 0
        updated = 0
        skipped = 0

        for vestiging in qs:
            processed += 1
            result = geocode_vestiging(vestiging, prefer_google=options['prefer_google'])
            if result is None:
                skipped += 1
                self.stdout.write(self.style.WARNING(f'Skip {vestiging.id}: geen resultaat'))
                continue
            apply_geocode_result(vestiging, result)
            updated += 1
            self.stdout.write(self.style.SUCCESS(f'OK {vestiging.id}: {result.label}'))

        self.stdout.write(
            self.style.SUCCESS(f'Klaar: {processed} verwerkt, {updated} bijgewerkt, {skipped} overgeslagen.')
        )
