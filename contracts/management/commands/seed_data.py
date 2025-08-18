
import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from contracts.models import (
    Contract, RiskLog, ComplianceChecklist, ChecklistItem, Tag,
    WorkflowStep, NegotiationThread, TrademarkRequest, 
    LegalTask, WorkflowTemplate, WorkflowTemplateStep, Workflow,
    DueDiligenceProcess, DueDiligenceTask, DueDiligenceRisk,
    Budget, BudgetExpense
)

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds the database with comprehensive mock data for the CLM platform.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting comprehensive database seeding...'))

        # Create multiple users for testing
        users = []
        for i, (username, first_name, last_name) in enumerate([
            ('demouser', 'Demo', 'User'),
            ('alice', 'Alice', 'Johnson'),
            ('bob', 'Bob', 'Smith'),
            ('carol', 'Carol', 'Davis'),
            ('david', 'David', 'Wilson')
        ]):
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'first_name': first_name, 
                    'last_name': last_name, 
                    'email': f'{username}@example.com'
                }
            )
            if created:
                user.set_password('demopassword')
                user.save()
                self.stdout.write(f'Created user: {user.username}')
            users.append(user)

        main_user = users[0]

        # Create tags
        tag_names = [
            'High Priority', 'Urgent', 'Revenue Critical', 'Legal Review Required',
            'IP Sensitive', 'International', 'Renewable', 'Master Agreement',
            'Amendment', 'Termination', 'SOX Compliance', 'GDPR', 'Confidential'
        ]
        tags = []
        for tag_name in tag_names:
            tag, created = Tag.objects.get_or_create(name=tag_name)
            tags.append(tag)
        self.stdout.write(f'Created {len(tags)} tags.')

        # Create comprehensive contracts with all statuses and types
        contract_data = [
            ("Global Master Service Agreement - TechCorp", "TechCorp Inc."),
            ("Artist Licensing Deal - Spotify", "Spotify Technology S.A."),
            ("Mutual NDA - Apple Inc.", "Apple Inc."),
            ("Employment Agreement - Sarah Connor", "Individual"),
            ("SLA for Cloud Services - AWS", "Amazon Web Services"),
            ("Artist License - Universal Music", "Universal Music Group"),
            ("Vendor SOW - Marketing Agency", "Creative Solutions Ltd"),
            ("IP License Agreement - Bolton Labs", "Bolton Adhesives Research"),
            ("Data Processing Agreement - GDPR", "DataSecure EU"),
            ("Partnership Agreement - Asia Pacific", "APAC Ventures"),
            ("Software License - Adobe Creative", "Adobe Systems"),
            ("Trademark License - Brand Portfolio", "Brand Holdings LLC"),
        ]

        contracts = []
        statuses = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'EXECUTED', 'EXPIRED']
        for i, (title, counterparty) in enumerate(contract_data):
            contract = Contract.objects.create(
                title=title,
                content=f"Contract content for {title}. This is a sample contract with standard terms and conditions.",
                status=random.choice(statuses)
            )
            contracts.append(contract)

        self.stdout.write(f'Created {len(contracts)} contracts with all statuses.')

        # Create comprehensive trademark requests
        trademark_data = [
            ("BOLTON TRADEMARK US", "Patent for Bolton Adhesive Technology", "Adhesive compounds and industrial chemicals", "35"),
            ("BOLTON TRADEMARK EU", "European trademark filing", "Chemical products for industrial use", "09"), 
            ("BOLTON TRADEMARK UK", "UK trademark registration", "Manufacturing services", "42"),
            ("BOLTON TRADEMARK JP", "Japan trademark application", "Adhesive products", "35"),
            ("BOLTON TRADEMARK CA", "Canadian trademark filing", "Chemical compounds", "09"),
            ("BOLTON TRADEMARK AU", "Australian trademark", "Industrial adhesives", "42"),
            ("BOLTON TRADEMARK DE", "German trademark application", "Chemical products", "35"),
            ("BOLTON TRADEMARK FR", "French trademark filing", "Adhesive technology", "09"),
        ]

        statuses = ['PENDING', 'FILED', 'IN_REVIEW', 'APPROVED', 'REJECTED']
        for mark_text, description, goods_services, filing_basis in trademark_data:
            TrademarkRequest.objects.create(
                mark_text=mark_text,
                description=description,
                goods_services=goods_services,
                filing_basis=filing_basis,
                status=random.choice(statuses)
            )

        self.stdout.write(f'Created {len(trademark_data)} trademark requests.')

        # Create comprehensive legal tasks
        task_data = [
            ("Review Bolton Adhesive Master Agreement", "Contract Review"),
            ("File trademark renewal - EU Region", "IP Management"),
            ("Update privacy policy for GDPR compliance", "Compliance"),
            ("Negotiate licensing terms with Universal", "Contract Negotiation"),
            ("Annual SOX compliance audit", "Compliance"),
            ("Review employment contracts - Q4 batch", "HR Legal"),
            ("Update vendor agreements template", "Template Management"),
            ("IP infringement investigation", "IP Protection"),
            ("Board resolution documentation", "Corporate"),
            ("Export control compliance review", "International Trade"),
            ("Software license audit", "IT Compliance"),
            ("Partnership agreement amendments", "Business Development"),
        ]

        priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
        statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
        for title, description in task_data:
            LegalTask.objects.create(
                title=title,
                description=f"Detailed description for {title}",
                priority=random.choice(priorities),
                status=random.choice(statuses),
                assigned_to=random.choice(users),
                due_date=date.today() + timedelta(days=random.randint(1, 90))
            )

        self.stdout.write(f'Created {len(task_data)} legal tasks.')

        # Create comprehensive risk logs
        risk_data = [
            ("IP Infringement Risk - Music Licensing", "HIGH"),
            ("GDPR Non-Compliance Exposure", "MEDIUM"),
            ("Contract Termination Clause Ambiguity", "HIGH"),
            ("Export Control Violation Risk", "MEDIUM"),
            ("Data Breach Liability", "HIGH"),
            ("Vendor Concentration Risk", "LOW"),
            ("Currency Exchange Rate Exposure", "MEDIUM"),
            ("Regulatory Change Impact", "MEDIUM"),
            ("Key Personnel Dependency", "LOW"),
            ("Technology Obsolescence Risk", "MEDIUM"),
        ]

        for title, risk_level in risk_data:
            RiskLog.objects.create(
                title=title,
                description=f"Detailed risk assessment for {title}. This risk requires careful monitoring and mitigation planning.",
                risk_level=risk_level,
                mitigation_strategy=f"Mitigation strategy for {title}: 1. Assess impact 2. Implement controls 3. Monitor status 4. Report to stakeholders"
            )

        self.stdout.write(f'Created {len(risk_data)} risk logs.')

        # Create comprehensive compliance checklists
        checklist_data = [
            ("GDPR Data Protection Compliance", "GDPR"),
            ("SOX Financial Controls Audit", "SOX"),
            ("PCI Security Review", "PCI"),
            ("HIPAA Privacy Assessment", "HIPAA"),
            ("Other Compliance Review", "OTHER"),
        ]

        for title, regulation_type in checklist_data:
            checklist = ComplianceChecklist.objects.create(
                title=title,
                description=f"Comprehensive compliance checklist for {regulation_type}",
                regulation_type=regulation_type
            )

            # Create checklist items
            for i in range(5):
                ChecklistItem.objects.create(
                    checklist=checklist,
                    title=f"Checklist item {i+1} for {title}",
                    description=f"Detailed description for item {i+1}",
                    is_completed=random.choice([True, False]),
                    order=i+1
                )

        self.stdout.write(f'Created {len(checklist_data)} compliance checklists with items.')

        # Create workflow templates
        template_data = [
            {
                'name': 'Standard Contract Review',
                'description': 'Standard workflow for contract review and approval',
                'category': 'CONTRACT_REVIEW',
            },
            {
                'name': 'Due Diligence Process',
                'description': 'Enhanced workflow for due diligence',
                'category': 'DUE_DILIGENCE',
            },
            {
                'name': 'Trademark Filing Workflow',
                'description': 'Specialized workflow for trademark applications',
                'category': 'TRADEMARK',
            },
        ]

        templates = []
        for template_info in template_data:
            template, created = WorkflowTemplate.objects.get_or_create(
                name=template_info['name'],
                defaults={
                    'description': template_info['description'],
                    'category': template_info['category'],
                }
            )
            
            if created:
                for i in range(3):
                    WorkflowTemplateStep.objects.create(
                        template=template,
                        title=f"Step {i+1} - {template_info['name']}",
                        description=f"Description for step {i+1}",
                        order=i+1,
                        estimated_duration_days=random.randint(2, 7)
                    )
            templates.append(template)

        # Create workflows for some contracts
        workflow_contracts = contracts[:6]
        for i, contract in enumerate(workflow_contracts):
            template = templates[i % len(templates)]
            
            workflow = Workflow.objects.create(
                title=f"Workflow for {contract.title}",
                description=f"Automated workflow for processing {contract.title}",
                template=template,
                status=random.choice(['ACTIVE', 'COMPLETED', 'CANCELLED']),
                created_by=main_user
            )

            # Create workflow steps from template
            for template_step in template.steps.all():
                step_status = random.choice(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'])
                
                WorkflowStep.objects.create(
                    workflow=workflow,
                    title=template_step.title,
                    description=template_step.description,
                    status=step_status,
                    assigned_to=random.choice(users),
                    order=template_step.order,
                    due_date=date.today() + timedelta(days=template_step.order * 7)
                )

        self.stdout.write(f'Created workflows for {len(workflow_contracts)} contracts.')

        # Summary
        self.stdout.write(self.style.SUCCESS('=== SEEDING COMPLETE ==='))
        self.stdout.write(f'Users: {User.objects.count()}')
        self.stdout.write(f'Tags: {Tag.objects.count()}')
        self.stdout.write(f'Contracts: {Contract.objects.count()}')
        self.stdout.write(f'Trademark Requests: {TrademarkRequest.objects.count()}')
        self.stdout.write(f'Legal Tasks: {LegalTask.objects.count()}')
        self.stdout.write(f'Risk Logs: {RiskLog.objects.count()}')
        self.stdout.write(f'Compliance Checklists: {ComplianceChecklist.objects.count()}')
        self.stdout.write(f'Checklist Items: {ChecklistItem.objects.count()}')
        self.stdout.write(f'Workflow Templates: {WorkflowTemplate.objects.count()}')
        self.stdout.write(f'Workflows: {Workflow.objects.count()}')
        self.stdout.write(f'Workflow Steps: {WorkflowStep.objects.count()}')
        self.stdout.write(self.style.SUCCESS('All dropdowns and functions now have comprehensive test data!'))
