from types import SimpleNamespace
from unittest.mock import patch

from django.db import DatabaseError
from django.test import RequestFactory, TestCase

from contracts.middleware import OrganizationMiddleware


class OrganizationMiddlewareTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_membership_lookup_failure_does_not_break_request(self):
        request = self.factory.get('/dashboard/')
        request.user = SimpleNamespace(is_authenticated=True)

        middleware = OrganizationMiddleware(lambda req: SimpleNamespace(status_code=200))

        # Both DB-touching paths must surface DatabaseError so the middleware's
        # fallback (request.organization = None) is the verified terminal state.
        # `ensure_user_organization` was added to the fallback path in da8dddb.
        with patch('contracts.middleware.OrganizationMembership.objects.filter', side_effect=DatabaseError), \
             patch('contracts.middleware.ensure_user_organization', side_effect=DatabaseError):
            response = middleware(request)

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(getattr(request, 'organization', None))
