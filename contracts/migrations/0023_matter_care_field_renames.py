from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0022_alter_riskfactor_options_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='matter',
            old_name='matter_number',
            new_name='configuration_id',
        ),
        migrations.RenameField(
            model_name='matter',
            old_name='responsible_attorney',
            new_name='responsible_care_coordinator',
        ),
        migrations.RenameField(
            model_name='matter',
            old_name='originating_attorney',
            new_name='intake_creator',
        ),
        migrations.RemoveField(
            model_name='matter',
            name='practice_area',
        ),
        migrations.RemoveField(
            model_name='matter',
            name='billing_type',
        ),
        migrations.RemoveField(
            model_name='matter',
            name='budget_amount',
        ),
    ]
