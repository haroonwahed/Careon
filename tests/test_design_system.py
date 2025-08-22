
from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from config.feature_flags import is_feature_redesign_enabled

class DesignSystemTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )

    def test_components_demo_page_loads(self):
        """Test that the components demo page loads successfully"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get('/components-demo/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Bolton CLM Design System')

    def test_components_demo_contains_all_sections(self):
        """Test that all design system sections are present"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get('/components-demo/')
        
        # Check for main sections
        self.assertContains(response, 'Typography')
        self.assertContains(response, 'Colors')
        self.assertContains(response, 'Buttons')
        self.assertContains(response, 'Form Controls')
        self.assertContains(response, 'Stats')
        self.assertContains(response, 'Badges')
        self.assertContains(response, 'Table')
        self.assertContains(response, 'Tabs')
        self.assertContains(response, 'Progress & Stepper')
        self.assertContains(response, 'Empty State')

    def test_feature_flag_system(self):
        """Test that feature flag system works"""
        import os
        
        # Test default value
        self.assertFalse(is_feature_redesign_enabled())
        
        # Test environment variable
        os.environ['FEATURE_REDESIGN'] = 'true'
        self.assertTrue(is_feature_redesign_enabled())
        
        # Clean up
        if 'FEATURE_REDESIGN' in os.environ:
            del os.environ['FEATURE_REDESIGN']

    def test_css_variables_in_demo(self):
        """Test that CSS variables are properly defined"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get('/components-demo/')
        content = response.content.decode()
        
        # Check that CSS variables are being used
        self.assertIn('--bg:', content)
        self.assertIn('--ink:', content)
        self.assertIn('--accent:', content)

class ComponentRenderingTestCase(TestCase):
    def test_button_classes_exist(self):
        """Test that button CSS classes are properly defined"""
        self.client = Client()
        response = self.client.get('/components-demo/')
        content = response.content.decode()
        
        # Check for button classes
        self.assertIn('btn-primary', content)
        self.assertIn('btn-secondary', content)
        self.assertIn('btn-ghost', content)
        self.assertIn('btn-destructive', content)

    def test_stat_components_structure(self):
        """Test that stat components have proper structure"""
        self.client = Client()
        response = self.client.get('/components-demo/')
        content = response.content.decode()
        
        # Check for stat structure
        self.assertIn('stat-value', content)
        self.assertIn('stat-label', content)
        self.assertIn('stat-icon', content)

    def test_table_structure(self):
        """Test that table components have proper structure"""
        self.client = Client()
        response = self.client.get('/components-demo/')
        content = response.content.decode()
        
        # Check for table classes
        self.assertIn('table-header', content)
        self.assertIn('table-body', content)
        self.assertIn('table-cell', content)
        self.assertIn('table-row', content)
