
from django.core.management.base import BaseCommand
from contracts.models import WorkflowTemplate, WorkflowTemplateStep
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Create sample care-flow templates'

    def handle(self, *args, **options):
        # Get the first user or create one for seed templates
        try:
            user = User.objects.first()
            if not user:
                user = User.objects.create_user('admin', 'admin@example.com', 'admin')
        except:
            user = User.objects.create_user('admin', 'admin@example.com', 'admin')

        templates_data = [
            {
                'name': 'Intake naar beoordeling',
                'description': 'Standaard flow van intake naar beoordeling en matching',
                'contract_type': 'NDA',
                'steps': [
                    ('INTERNAL_REVIEW', 1),
                    ('EXTERNAL_REVIEW', 2),
                    ('NEGOTIATION', 3),
                    ('SIGNATURE', 4),
                    ('EXECUTION', 5),
                ]
            },
            {
                'name': 'Spoedcasus',
                'description': 'Versnelde flow voor urgente casussen',
                'contract_type': 'NDA',
                'steps': [
                    ('INTERNAL_REVIEW', 1),
                    ('NEGOTIATION', 2),
                    ('SIGNATURE', 3),
                    ('EXECUTION', 4),
                ]
            },
            {
                'name': 'Plaatsing met nazorg',
                'description': 'Volledige flow inclusief plaatsing en opvolging',
                'contract_type': 'SOW',
                'steps': [
                    ('INTERNAL_REVIEW', 1),
                    ('EXTERNAL_REVIEW', 2),
                    ('NEGOTIATION', 3),
                    ('SIGNATURE', 4),
                    ('EXECUTION', 5),
                ]
            },
            {
                'name': 'Capaciteitstekort escalatie',
                'description': 'Escalatieflow voor cases zonder passende capaciteit',
                'contract_type': 'LEASE',
                'steps': [
                    ('INTERNAL_REVIEW', 1),
                    ('EXTERNAL_REVIEW', 2),
                    ('NEGOTIATION', 3),
                    ('SIGNATURE', 4),
                    ('EXECUTION', 5),
                ]
            },
            {
                'name': 'Regionale afstemming',
                'description': 'Afstemming tussen gemeenten en aanbieders per regio',
                'contract_type': 'PARTNERSHIP',
                'steps': [
                    ('INTERNAL_REVIEW', 1),
                    ('EXTERNAL_REVIEW', 2),
                    ('NEGOTIATION', 3),
                    ('SIGNATURE', 4),
                    ('EXECUTION', 5),
                ]
            },
        ]

        for template_data in templates_data:
            template, created = WorkflowTemplate.objects.get_or_create(
                name=template_data['name'],
                defaults={
                    'description': template_data['description'],
                    'contract_type': template_data['contract_type'],
                    'created_by': user,
                    'is_active': True,
                }
            )

            if created:
                self.stdout.write(f"Template aangemaakt: {template.name}")

                # Create template steps
                for step_type, order in template_data['steps']:
                    WorkflowTemplateStep.objects.create(
                        template=template,
                        step_type=step_type,
                        order=order
                    )
                    self.stdout.write(f"  Stap toegevoegd: {step_type} (volgorde: {order})")
            else:
                self.stdout.write(f"Template bestaat al: {template.name}")

        self.stdout.write(self.style.SUCCESS('Care-flow templates succesvol aangemaakt'))
