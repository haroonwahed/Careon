from django.test import TestCase
from django.contrib.auth import get_user_model
from .tenancy import ensure_user_organization
from .models import CareSignal, CareCase

User = get_user_model()

class Phase5ModelTests(TestCase):

    def setUp(self):
        """Set up non-modified objects used by all test methods."""
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        org = ensure_user_organization(self.user)
        self.contract = CareCase.objects.create(title='Test Case', created_by=self.user, organization=org)

    def test_create_care_signal(self):
        """Test that a CareSignal can be created."""
        risk = CareSignal.objects.create(
            title='Test Risk',
            description='A test risk description.',
            created_by=self.user,
            case_record=self.contract,
            mitigation_plan='Take test steps.'
        )
        self.assertIsNotNone(risk)
        self.assertEqual(risk.risk_level, 'MEDIUM')
        self.assertEqual(risk.contract, self.contract)
        self.assertEqual(str(risk), 'Test Risk')

    def test_contract_currency_defaults_to_eur(self):
        """Test that care cases default to EUR currency."""
        self.assertEqual(self.contract.currency, CareCase.Currency.EUR)
