from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from contracts.models import AanbiederVestiging, CapaciteitRecord, ProviderImportBatch, Zorgaanbieder


class Command(BaseCommand):
    help = "Append an internal operational capacity snapshot for a provider vestiging (no fabrication)."

    def add_arguments(self, parser):
        parser.add_argument("--provider-agb", required=True, help="Provider AGB code")
        parser.add_argument("--vestiging-code", default="PRIMARY", help="Vestiging code")
        parser.add_argument("--open-slots", type=int, required=True, help="Available slots now")
        parser.add_argument("--waiting-list-size", type=int, required=True, help="Current waiting list count")
        parser.add_argument("--avg-wait-days", type=int, required=True, help="Average wait time in days")
        parser.add_argument("--max-capacity", type=int, required=True, help="Max capacity")
        parser.add_argument("--intake-speed-days", type=int, default=None, help="Operational intake speed in days")
        parser.add_argument("--notes", default="", help="Operational note")
        parser.add_argument("--updated-by", required=True, help="Actor identifier")

    def handle(self, *args, **options):
        agb = str(options["provider_agb"]).strip()
        provider = Zorgaanbieder.objects.filter(agb_code=agb).first()
        if provider is None:
            raise CommandError(f"No provider found with AGB code {agb}")

        vestiging_code = str(options["vestiging_code"]).strip() or "PRIMARY"
        vestiging = AanbiederVestiging.objects.filter(
            zorgaanbieder=provider,
            vestiging_code=vestiging_code,
        ).first()
        if vestiging is None:
            raise CommandError(
                f"No vestiging found for provider={agb} with vestiging_code={vestiging_code}"
            )

        open_slots = options["open_slots"]
        waiting_list_size = options["waiting_list_size"]
        avg_wait_days = options["avg_wait_days"]
        max_capacity = options["max_capacity"]
        intake_speed_days = options.get("intake_speed_days")

        if min(open_slots, waiting_list_size, avg_wait_days, max_capacity) < 0:
            raise CommandError("Capacity values cannot be negative")
        if open_slots > max_capacity:
            raise CommandError("open-slots cannot exceed max-capacity")

        batch = ProviderImportBatch.objects.create(
            source_system="internal_operational_manual",
            source_version="1.0",
            triggered_by=f"manage.py update_provider_capacity ({options['updated_by']})",
            status=ProviderImportBatch.BatchStatus.COMPLETED,
            started_at=timezone.now(),
            completed_at=timezone.now(),
            total_records=1,
            processed_records=1,
            created_records=1,
            updated_records=0,
            skipped_records=0,
            conflicted_records=0,
            quarantined_records=0,
        )

        notes = str(options["notes"] or "").strip()
        if intake_speed_days is not None:
            intake_note = f"Intake speed: {intake_speed_days} dagen"
            notes = f"{notes} | {intake_note}".strip(" |")

        record = CapaciteitRecord.objects.create(
            vestiging=vestiging,
            import_batch=batch,
            open_slots=open_slots,
            waiting_list_size=waiting_list_size,
            avg_wait_days=avg_wait_days,
            max_capacity=max_capacity,
            capaciteit_type="operationeel",
            totale_capaciteit=max_capacity,
            beschikbare_capaciteit=open_slots,
            wachtlijst_aantal=waiting_list_size,
            gemiddelde_wachttijd_dagen=avg_wait_days,
            direct_pleegbaar=open_slots > 0,
            toelichting_capaciteit=notes,
            betrouwbaarheid_score=1.0,
            laatst_bijgewerkt_op=timezone.now(),
            laatst_bijgewerkt_door=str(options["updated_by"]).strip(),
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Capacity snapshot stored: "
                f"provider={provider.name} vestiging={vestiging.vestiging_code} record_id={record.pk}"
            )
        )
