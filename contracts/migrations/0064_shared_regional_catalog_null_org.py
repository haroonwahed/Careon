"""
Shared RegionalConfiguration rows (organization=NULL) for intake / nieuwe-casus.

CaseIntakeProcessForm scopes regio to (active tenant OR organization IS NULL). Demo seed
only attached regions to specific organizations, so new tenants (e.g. auto-provisioned
orgs) saw an empty regio dropdown. These catalog rows are tenant-neutral fallbacks.
"""

from django.db import migrations


def forwards(apps, schema_editor):
    RegionalConfiguration = apps.get_model("contracts", "RegionalConfiguration")
    seeds = [
        {
            "region_code": "SYS-CAT-GEM-AMS",
            "region_name": "Amsterdam (gemeentelijk)",
            "province": "Noord-Holland",
        },
        {
            "region_code": "SYS-CAT-GEM-UTR",
            "region_name": "Utrecht (gemeentelijk)",
            "province": "Utrecht",
        },
        {
            "region_code": "SYS-CAT-GEM-RTM",
            "region_name": "Rotterdam (gemeentelijk)",
            "province": "Zuid-Holland",
        },
    ]
    for row in seeds:
        obj, created = RegionalConfiguration.objects.get_or_create(
            organization=None,
            region_code=row["region_code"],
            defaults={
                "region_type": "GEMEENTELIJK",
                "region_name": row["region_name"],
                "province": row["province"],
                "status": "ACTIVE",
            },
        )
        if not created:
            updates = []
            if obj.status != "ACTIVE":
                obj.status = "ACTIVE"
                updates.append("status")
            if obj.region_type != "GEMEENTELIJK":
                obj.region_type = "GEMEENTELIJK"
                updates.append("region_type")
            if obj.region_name != row["region_name"]:
                obj.region_name = row["region_name"]
                updates.append("region_name")
            if obj.province != row["province"]:
                obj.province = row["province"]
                updates.append("province")
            if updates:
                obj.save(update_fields=updates)


def backwards(apps, schema_editor):
    RegionalConfiguration = apps.get_model("contracts", "RegionalConfiguration")
    RegionalConfiguration.objects.filter(
        organization__isnull=True,
        region_code__in=[
            "SYS-CAT-GEM-AMS",
            "SYS-CAT-GEM-UTR",
            "SYS-CAT-GEM-RTM",
        ],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("contracts", "0063_governance_v12_lifecycle"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
