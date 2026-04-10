from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from contracts.models import (
    CareCase, Client, CareConfiguration, Document, TrustAccount,
    Deadline, LegalTask, RiskLog, UserProfile
)
from datetime import date, timedelta
from decimal import Decimal

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds the database with sample data for development'

    def handle(self, *args, **options):
        if User.objects.filter(username='admin').exists():
            self.stdout.write(self.style.WARNING('Seed data already exists. Skipping.'))
            return

        admin = User.objects.create_superuser('admin', 'admin@careon.local', 'admin123', first_name='Admin', last_name='User')
        UserProfile.objects.get_or_create(user=admin, defaults={'role': 'ADMIN'})

        coordinator1 = User.objects.create_user('jsmith', 'jsmith@careon.local', 'password123', first_name='John', last_name='Smith')
        UserProfile.objects.get_or_create(user=coordinator1, defaults={'role': 'PARTNER', 'bar_number': 'BAR-001', 'hourly_rate': Decimal('450')})

        coordinator2 = User.objects.create_user('sjones', 'sjones@careon.local', 'password123', first_name='Sarah', last_name='Jones')
        UserProfile.objects.get_or_create(user=coordinator2, defaults={'role': 'SENIOR_ASSOCIATE', 'bar_number': 'BAR-002', 'hourly_rate': Decimal('350')})

        support_worker = User.objects.create_user('mwilson', 'mwilson@careon.local', 'password123', first_name='Mike', last_name='Wilson')
        UserProfile.objects.get_or_create(user=support_worker, defaults={'role': 'PARALEGAL', 'hourly_rate': Decimal('150')})

        client1 = Client.objects.create(
            name='Acme Corporation', client_type='CORPORATE', status='ACTIVE',
            email='intake@acme.com', phone='555-0100', industry='Technology',
            address='123 Tech Blvd', city='San Francisco', state='CA', zip_code='94105',
            primary_contact='Jane Doe', primary_contact_email='jane@acme.com',
            responsible_attorney=coordinator1, originating_attorney=coordinator1,
            created_by=admin
        )
        client2 = Client.objects.create(
            name='Global Industries LLC', client_type='CORPORATE', status='ACTIVE',
            email='zorgregie@globalind.com', phone='555-0200', industry='Manufacturing',
            address='456 Industrial Way', city='Chicago', state='IL', zip_code='60601',
            primary_contact='Bob Smith', primary_contact_email='bob@globalind.com',
            responsible_attorney=coordinator2, originating_attorney=coordinator1,
            created_by=admin
        )
        client3 = Client.objects.create(
            name='Sarah Williams', client_type='INDIVIDUAL', status='ACTIVE',
            email='swilliams@email.com', phone='555-0300',
            responsible_attorney=coordinator2, created_by=admin
        )

        today = date.today()

        matter1 = CareConfiguration.objects.create(
            title='Plaatsingsaanvraag - Acme Zorgteam', client=client1,
            practice_area='CORPORATE', status='ACTIVE',
            responsible_attorney=coordinator1, originating_attorney=coordinator1,
            billing_type='HOURLY', budget_amount=Decimal('50000'),
            open_date=today - timedelta(days=30), created_by=admin
        )
        matter2 = CareConfiguration.objects.create(
            title='Intake escalatie - Williams', client=client3,
            practice_area='LABOR', status='ACTIVE',
            responsible_attorney=coordinator2,
            billing_type='HOURLY', budget_amount=Decimal('15000'),
            open_date=today - timedelta(days=60),
            opposing_party='Regionaal crisisteam', opposing_counsel='Coordinatiepunt Noord',
            court_name='Externe beoordelingscommissie', case_number='2026-CASE-12345',
            statute_of_limitations=today + timedelta(days=180), created_by=admin
        )
        matter3 = CareConfiguration.objects.create(
            title='Regionale capaciteitsafstemming - Global Industries', client=client2,
            practice_area='IP', status='ACTIVE',
            responsible_attorney=coordinator1, originating_attorney=coordinator2,
            billing_type='FLAT_FEE', budget_amount=Decimal('25000'),
            open_date=today - timedelta(days=15), created_by=admin
        )

        contract1 = CareCase.objects.create(
            title='Casusdossier - Acme ambulante ondersteuning', contract_type='MSA',
            content='Zorgregie dossierinhoud voor plaatsingsafspraken.', status='ACTIVE',
            preferred_provider='TechStart Inc', value=Decimal('500000'),
            start_date=today - timedelta(days=90), end_date=today + timedelta(days=275),
            client=client1, matter=matter1, created_by=coordinator1
        )
        contract2 = CareCase.objects.create(
            title='Casusdossier - Global capaciteitsoverbrugging', contract_type='NDA',
            content='Afstemming en afspraken rondom tijdelijke capaciteit.', status='ACTIVE',
            preferred_provider='Global Industries LLC', value=Decimal('0'),
            start_date=today - timedelta(days=60), end_date=today + timedelta(days=305),
            client=client2, matter=matter3, created_by=coordinator2
        )
        contract3 = CareCase.objects.create(
            title='Concept plaatsingsplan', contract_type='SETTLEMENT',
            content='Conceptvoorwaarden voor passende zorgplaatsing.', status='DRAFT',
            preferred_provider='Former Employer Inc', value=Decimal('75000'),
            client=client3, matter=matter2, created_by=coordinator2
        )

        TrustAccount.objects.create(
            provider=client1,
            region='Regio Noord',
            care_type=TrustAccount.CareType.AMBULANT,
            wait_days=28,
            open_slots=3,
            waiting_list_size=14,
            notes='Instroom mogelijk na intake.',
            created_by=admin
        )

        Deadline.objects.create(
            title='Intake afronden', task_type='INTAKE_COMPLETE',
            priority='HIGH', due_date=today + timedelta(days=5),
            matter=matter2, assigned_to=coordinator2, created_by=admin
        )
        Deadline.objects.create(
            title='Beoordeling uitvoeren', task_type='ASSESSMENT_PERFORM',
            priority='URGENT', due_date=today + timedelta(days=14),
            matter=matter1, assigned_to=coordinator1, created_by=admin
        )
        Deadline.objects.create(
            title='Plaatsing bevestigen', task_type='CONFIRM_PLACEMENT',
            priority='MEDIUM', due_date=today + timedelta(days=30),
            contract=contract2, assigned_to=coordinator2, created_by=admin
        )

        LegalTask.objects.create(
            title='Bereid intakevragen voor', description='Stel de eerste set intakevragen op voor het gezin',
            priority='HIGH', status='PENDING',
            due_date=today + timedelta(days=7), assigned_to=coordinator2,
            matter=matter2
        )
        LegalTask.objects.create(
            title='Controleer aanbiederprofiel', description='Rond beoordeling van het aanbiederprofiel af',
            priority='MEDIUM', status='IN_PROGRESS',
            due_date=today + timedelta(days=10), assigned_to=coordinator1,
            matter=matter3
        )

        RiskLog.objects.create(
            title='Capaciteitsrisico - Regio Noord', description='Verhoogde kans op wachttijd door beperkte plekken',
            risk_level='HIGH', mitigation_plan='Stem extra inkoop en tijdelijke overbrugging af met gemeenten',
            contract=contract1, matter=matter1, created_by=admin
        )

        self.stdout.write(self.style.SUCCESS('Seeddata succesvol aangemaakt.'))
        self.stdout.write(f'  Admin user: admin / admin123')
        self.stdout.write(f'  3 clients, 3 matters, 3 contracts')
        self.stdout.write(f'  1 wachttijdregistratie')
        self.stdout.write(f'  3 deadlines, 2 tasks, 1 risk')
