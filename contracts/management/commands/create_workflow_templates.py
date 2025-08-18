
from django.core.management.base import BaseCommand
from contracts.models import WorkflowTemplate, WorkflowTemplateStep
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Create sample workflow templates'

    def handle(self, *args, **options):
        # Get the first user or create one for templates
        try:
            user = User.objects.first()
            if not user:
                user = User.objects.create_user('admin', 'admin@example.com', 'admin')
        except:
            user = User.objects.create_user('admin', 'admin@example.com', 'admin')

        templates_data = [
            {
                'name': 'Artist Licensing Agreement',
                'description': 'Standard workflow for artist licensing agreements',
                'contract_type': 'LICENSE',
                'steps': [
                    ('INTERNAL_REVIEW', 1),
                    ('EXTERNAL_REVIEW', 2),
                    ('NEGOTIATION', 3),
                    ('SIGNATURE', 4),
                    ('EXECUTION', 5),
                ]
            },
            {
                'name': 'Mutual NDA',
                'description': 'Standard workflow for mutual non-disclosure agreements',
                'contract_type': 'NDA',
                'steps': [
                    ('INTERNAL_REVIEW', 1),
                    ('EXTERNAL_REVIEW', 2),
                    ('SIGNATURE', 3),
                    ('EXECUTION', 4),
                ]
            },
            {
                'name': 'Vendor Agreement',
                'description': 'Standard workflow for vendor procurement agreements',
                'contract_type': 'MSA',
                'steps': [
                    ('INTERNAL_REVIEW', 1),
                    ('EXTERNAL_REVIEW', 2),
                    ('NEGOTIATION', 3),
                    ('SIGNATURE', 4),
                    ('EXECUTION', 5),
                ]
            },
            {
                'name': 'Artist Licensing - Lothaire',
                'description': 'Specific workflow for Lothaire artist licensing',
                'contract_type': 'LICENSE',
                'steps': [
                    ('INTERNAL_REVIEW', 1),
                    ('EXTERNAL_REVIEW', 2),
                    ('NEGOTIATION', 3),
                    ('SIGNATURE', 4),
                    ('EXECUTION', 5),
                ]
            },
            {
                'name': 'Artist Licensing - Armora',
                'description': 'Specific workflow for Armora artist licensing',
                'contract_type': 'LICENSE',
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
                self.stdout.write(f"Created template: {template.name}")
                
                # Create template steps
                for step_type, order in template_data['steps']:
                    WorkflowTemplateStep.objects.create(
                        template=template,
                        step_type=step_type,
                        order=order
                    )
                    self.stdout.write(f"  Added step: {step_type} (order: {order})")
            else:
                self.stdout.write(f"Template already exists: {template.name}")

        self.stdout.write(self.style.SUCCESS('Successfully created workflow templates'))
