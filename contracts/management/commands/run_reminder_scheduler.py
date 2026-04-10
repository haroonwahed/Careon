import time
from datetime import timedelta

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Run an in-process scheduler that periodically sends case reminders.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval-minutes',
            type=int,
            default=60,
            help='How often to execute send_contract_reminders (default: 60).',
        )
        parser.add_argument(
            '--once',
            action='store_true',
            help='Run send_contract_reminders once and exit.',
        )

    def handle(self, *args, **options):
        interval_minutes = max(1, options['interval_minutes'])
        run_once = options['once']

        if run_once:
            call_command('send_contract_reminders')
            self.stdout.write(self.style.SUCCESS('Herinneringsplanner eenmalig uitgevoerd.'))
            return

        self.stdout.write(
            self.style.SUCCESS(
                f'Herinneringsplanner gestart. Draait elke {interval_minutes} minuut/minuten.'
            )
        )

        next_run = timezone.now()
        while True:
            now = timezone.now()
            if now >= next_run:
                call_command('send_contract_reminders')
                next_run = now + timedelta(minutes=interval_minutes)
                self.stdout.write(
                    self.style.SUCCESS(f'Volgende herinneringsrun gepland om {next_run.isoformat()}.')
                )
            time.sleep(5)
