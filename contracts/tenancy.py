from typing import Optional

from django.contrib.auth import get_user_model
from django.db import DatabaseError, IntegrityError
from django.db.models import Model, QuerySet
from django.shortcuts import get_object_or_404
from django.utils.text import slugify

from .models import Organization, OrganizationMembership

User = get_user_model()


def ensure_user_organization(user: Optional[User]) -> Optional[Organization]:
    if not user or not getattr(user, 'is_authenticated', False):
        return None

    try:
        memberships = (
            OrganizationMembership.objects
            .filter(user=user, is_active=True, organization__is_active=True)
            .select_related('organization')
        )
        existing = memberships.order_by('id').first()
        if existing:
            return existing.organization
    except DatabaseError:
        return None

    org_name = f"{user.get_full_name().strip() or user.username}'s Regie"
    existing_organization = Organization.objects.filter(name=org_name).first()
    if existing_organization:
        membership, _ = OrganizationMembership.objects.get_or_create(
            organization=existing_organization,
            user=user,
            defaults={
                'role': OrganizationMembership.Role.OWNER,
                'is_active': True,
            },
        )
        updates = []
        if membership.role != OrganizationMembership.Role.OWNER:
            membership.role = OrganizationMembership.Role.OWNER
            updates.append('role')
        if not membership.is_active:
            membership.is_active = True
            updates.append('is_active')
        if updates:
            membership.save(update_fields=updates)
        return existing_organization

    base_slug = slugify(getattr(user, 'username', '') or f'user-{user.id}') or f'user-{user.id}'
    org_slug = base_slug
    n = 2
    while Organization.objects.filter(slug=org_slug).exists():
        org_slug = f'{base_slug}-{n}'
        n += 1

    try:
        organization = Organization.objects.create(name=org_name, slug=org_slug)
    except IntegrityError:
        organization = Organization.objects.filter(name=org_name).first()
        if organization is None:
            raise

    membership, _ = OrganizationMembership.objects.get_or_create(
        organization=organization,
        user=user,
        defaults={
            'role': OrganizationMembership.Role.OWNER,
            'is_active': True,
        },
    )
    updates = []
    if membership.role != OrganizationMembership.Role.OWNER:
        membership.role = OrganizationMembership.Role.OWNER
        updates.append('role')
    if not membership.is_active:
        membership.is_active = True
        updates.append('is_active')
    if updates:
        membership.save(update_fields=updates)
    return organization


def get_user_organization(user: Optional[User]) -> Optional[Organization]:
    if not user or not getattr(user, 'is_authenticated', False):
        return None

    try:
        base_org = ensure_user_organization(user)
    except DatabaseError:
        return None

    preferred_org_id = getattr(user, '_active_organization_id', None)
    if preferred_org_id:
        try:
            selected = (
                OrganizationMembership.objects
                .filter(
                    user=user,
                    is_active=True,
                    organization__is_active=True,
                    organization_id=preferred_org_id,
                )
                .select_related('organization')
                .first()
            )
            if selected:
                return selected.organization
        except DatabaseError:
            return base_org

    return base_org


def scope_queryset_for_organization(queryset: QuerySet, organization: Optional[Organization]) -> QuerySet:
    if organization is None:
        return queryset.none()

    scoped_method = getattr(queryset, 'for_organization', None)
    if callable(scoped_method):
        scoped_queryset = scoped_method(organization)
        if scoped_queryset is not None:
            return scoped_queryset

    model_cls: type[Model] = queryset.model
    field_names = {f.name for f in model_cls._meta.get_fields()}
    if 'organization' in field_names:
        return queryset.filter(organization=organization)
    return queryset


def get_scoped_object_or_404(queryset: QuerySet, organization: Optional[Organization], **lookup):
    return get_object_or_404(scope_queryset_for_organization(queryset, organization), **lookup)


def set_organization_on_instance(instance: Model, organization: Optional[Organization]) -> None:
    if organization is None:
        return
    if hasattr(instance, 'organization_id') and not getattr(instance, 'organization_id', None):
        instance.organization = organization
