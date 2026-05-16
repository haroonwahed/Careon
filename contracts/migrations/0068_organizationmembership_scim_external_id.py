# Align OrganizationMembership with production Postgres (scim_external_id NOT NULL drift).

from django.db import migrations, models


def _ensure_scim_column(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'contracts_organizationmembership'
              AND column_name = 'scim_external_id'
            """
        )
        if cursor.fetchone():
            cursor.execute(
                """
                UPDATE contracts_organizationmembership
                SET scim_external_id = ''
                WHERE scim_external_id IS NULL
                """
            )
            cursor.execute(
                """
                ALTER TABLE contracts_organizationmembership
                ALTER COLUMN scim_external_id SET DEFAULT ''
                """
            )
            return
        cursor.execute(
            """
            ALTER TABLE contracts_organizationmembership
            ADD COLUMN scim_external_id varchar(255) NOT NULL DEFAULT ''
            """
        )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0067_organization_operational_preferences'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_ensure_scim_column, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='organizationmembership',
                    name='scim_external_id',
                    field=models.CharField(
                        blank=True,
                        default='',
                        help_text='Optional SCIM provisioner identifier (empty when not SSO-provisioned).',
                        max_length=255,
                    ),
                ),
            ],
        ),
    ]
