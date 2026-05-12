# Generated manually — additive product metadata (not a security role).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("contracts", "0064_shared_regional_catalog_null_org"),
    ]

    operations = [
        migrations.AddField(
            model_name="caseintakeprocess",
            name="aanmelder_actor_profile",
            field=models.CharField(
                choices=[
                    ("ONBEKEND", "Onbekend / legacy"),
                    ("WIJKTEAM", "Wijkteam (instroom WIJKTEAM)"),
                    ("GEMEENTE_AMBTELIJK", "Gemeente-account (standaardroute)"),
                    ("ZORGAANBIEDER_ORG", "Zorgaanbieder-organisatie"),
                    ("ADMIN", "Platformbeheer"),
                ],
                db_index=True,
                default="ONBEKEND",
                help_text=(
                    "Niet-autoriserende classificatie voor rapportage/audit. "
                    "Rechten en workflow blijven gekoppeld aan WorkflowRole op de gebruiker."
                ),
                max_length=32,
                verbose_name="Aanmelder-profiel (product)",
            ),
        ),
    ]
