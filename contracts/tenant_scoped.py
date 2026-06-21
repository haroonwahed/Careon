"""
DB-level tenant backstop — default queryset scoping when request context is set.

View-layer filters remain the primary contract; this module ensures a forgotten
``get_scoped_object_or_404`` cannot return another tenant's row during a request.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import QuerySet

from contracts.tenant_context import get_organization_id, is_bypass_active


def tenant_db_backstop_enabled() -> bool:
    return bool(getattr(settings, 'TENANT_DB_BACKSTOP_ENABLED', True))


def apply_tenant_scope(queryset: QuerySet) -> QuerySet:
    if not tenant_db_backstop_enabled() or is_bypass_active():
        return queryset

    org_id = get_organization_id()
    if org_id is None:
        return queryset

    scoped_method = getattr(queryset, 'for_organization', None)
    if callable(scoped_method):
        from contracts.models import Organization

        organization = Organization.objects.filter(pk=org_id).first()
        if organization is None:
            return queryset.none()
        return scoped_method(organization)

    field_names = {field.name for field in queryset.model._meta.get_fields()}
    if 'organization_id' in field_names or 'organization' in field_names:
        return queryset.filter(organization_id=org_id)

    return queryset


class TenantScopedQuerySet(models.QuerySet):
    """QuerySet mixin for models with a direct organization FK."""

    def for_organization(self, organization):
        if not organization:
            return self.none()
        return self.filter(organization=organization)


class TenantScopedManager(models.Manager):
    """Default manager that applies tenant backstop on reads."""

    def get_queryset(self):
        return apply_tenant_scope(super().get_queryset())

    def unscoped(self):
        return super().get_queryset()

    def for_organization(self, organization):
        return self.unscoped().for_organization(organization)
