# Generated migration: rename legacy model classes to care-native names.
# Database changes: rename M2M junction table FK columns to reflect new model names.
# All 7 model table names are unchanged (via db_table overrides or AlterModelTable).
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0024_alter_matter_intake_creator_and_more'),
    ]

    operations = [
        # Use SeparateDatabaseAndState so:
        #   - database_operations: perform actual SQL column renames in M2M junction tables
        #   - state_operations: update Django migration state with all model renames
        migrations.SeparateDatabaseAndState(
            database_operations=[
                # CareConfiguration (was Matter): rename matter_id column in junction tables
                migrations.RunSQL(
                    sql="ALTER TABLE contracts_care_configuration_care_domains RENAME COLUMN matter_id TO careconfiguration_id",
                    reverse_sql="ALTER TABLE contracts_care_configuration_care_domains RENAME COLUMN careconfiguration_id TO matter_id",
                ),
                migrations.RunSQL(
                    sql="ALTER TABLE contracts_care_configuration_linked_providers RENAME COLUMN matter_id TO careconfiguration_id",
                    reverse_sql="ALTER TABLE contracts_care_configuration_linked_providers RENAME COLUMN careconfiguration_id TO matter_id",
                ),
                migrations.RunSQL(
                    sql="ALTER TABLE contracts_care_configuration_team_members RENAME COLUMN matter_id TO careconfiguration_id",
                    reverse_sql="ALTER TABLE contracts_care_configuration_team_members RENAME COLUMN careconfiguration_id TO matter_id",
                ),
                # CaseIntakeProcess (was DueDiligenceProcess): rename column in risk_factors junction table
                migrations.RunSQL(
                    sql="ALTER TABLE contracts_duediligenceprocess_risk_factors RENAME COLUMN duediligenceprocess_id TO caseintakeprocess_id",
                    reverse_sql="ALTER TABLE contracts_duediligenceprocess_risk_factors RENAME COLUMN caseintakeprocess_id TO duediligenceprocess_id",
                ),
                # Budget M2M: rename columns pointing to renamed models
                migrations.RunSQL(
                    sql="ALTER TABLE contracts_budget_linked_cases RENAME COLUMN duediligenceprocess_id TO caseintakeprocess_id",
                    reverse_sql="ALTER TABLE contracts_budget_linked_cases RENAME COLUMN caseintakeprocess_id TO duediligenceprocess_id",
                ),
                migrations.RunSQL(
                    sql="ALTER TABLE contracts_budget_linked_placements RENAME COLUMN trademarkrequest_id TO placementrequest_id",
                    reverse_sql="ALTER TABLE contracts_budget_linked_placements RENAME COLUMN placementrequest_id TO trademarkrequest_id",
                ),
            ],
            state_operations=[
                migrations.RenameModel('DueDiligenceProcess', 'CaseIntakeProcess'),
                migrations.RenameModel('DueDiligenceTask', 'IntakeTask'),
                migrations.RenameModel('DueDiligenceRisk', 'CaseRiskSignal'),
                migrations.RenameModel('TrademarkRequest', 'PlacementRequest'),
                migrations.RenameModel('LegalTask', 'CareTask'),
                migrations.RenameModel('Matter', 'CareConfiguration'),
                migrations.RenameModel('Contract', 'CareCase'),
            ],
        ),
    ]
