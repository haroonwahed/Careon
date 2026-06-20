from django.db import models
from django.contrib.auth import get_user_model
from datetime import date
import uuid
import os

User = get_user_model()


class RegionType(models.TextChoices):
    GEMEENTELIJK = 'GEMEENTELIJK', 'Gemeentelijk'
    JEUGDREGIO = 'JEUGDREGIO', 'Jeugdregio'
    ROAZ = 'ROAZ', 'ROAZ'
    GGD = 'GGD', 'GGD'
    ZORGKANTOOR = 'ZORGKANTOOR', 'Zorgkantoor'
    CUSTOM = 'CUSTOM', 'Aangepast'


class OutcomeReasonCode(models.TextChoices):
    NONE = 'NONE', 'Geen specifieke reden'
    CAPACITY = 'CAPACITY', 'Capaciteit'
    WAITLIST = 'WAITLIST', 'Wachtlijst'
    CLIENT_DECLINED = 'CLIENT_DECLINED', 'Client heeft afgezien'
    PROVIDER_DECLINED = 'PROVIDER_DECLINED', 'Aanbieder heeft afgewezen'
    NO_SHOW = 'NO_SHOW', 'Niet verschenen'
    NO_RESPONSE = 'NO_RESPONSE', 'Geen reactie'
    CARE_MISMATCH = 'CARE_MISMATCH', 'Zorgvraag past niet'
    REGION_MISMATCH = 'REGION_MISMATCH', 'Regio past niet'
    SAFETY_RISK = 'SAFETY_RISK', 'Veiligheidsrisico'
    ADMINISTRATIVE_BLOCK = 'ADMINISTRATIVE_BLOCK', 'Administratieve blokkade'
    OTHER = 'OTHER', 'Anders'


def document_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    return f'documents/{uuid.uuid4().hex}{ext}'


def _generate_source_reference(prefix: str = 'BR') -> str:
    return f'{prefix}-{date.today().year}-{uuid.uuid4().hex[:6].upper()}'


class Organization(models.Model):
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    is_active = models.BooleanField(default=True)
    require_mfa = models.BooleanField(
        default=False,
        help_text='When enabled, members must complete MFA before access.',
    )
    daily_digest = models.BooleanField(
        default=True,
        help_text='Send operational digest notifications to organization members.',
    )
    critical_alerts = models.BooleanField(
        default=True,
        help_text='Surface critical chain blockers to authorized members.',
    )
    auto_escalation = models.BooleanField(
        default=True,
        help_text='Allow automatic escalation when cases stall in the chain.',
    )
    default_region = models.CharField(
        max_length=120,
        blank=True,
        default='',
        help_text='Default region label for intake and matching context.',
    )
    default_timezone = models.CharField(
        max_length=64,
        blank=True,
        default='Europe/Amsterdam',
    )
    default_language = models.CharField(
        max_length=16,
        blank=True,
        default='nl',
    )
    default_theme = models.CharField(
        max_length=32,
        blank=True,
        default='system',
    )
    logo_url = models.CharField(
        max_length=500,
        blank=True,
        default='',
    )
    contact_email = models.EmailField(blank=True, default='')
    notification_email = models.EmailField(
        blank=True,
        default='',
        help_text='Optional shared inbox for operational notifications.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class OrganizationMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = 'OWNER', 'Owner'
        ADMIN = 'ADMIN', 'Admin'
        MEMBER = 'MEMBER', 'Member'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='organization_memberships')
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    is_active = models.BooleanField(default=True)
    scim_external_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Optional SCIM provisioner identifier (empty when not SSO-provisioned).',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('organization', 'user')
        ordering = ['organization__name', 'user__username']

    def __str__(self):
        return f'{self.user.username} @ {self.organization.name} ({self.role})'


class OrganizationInvitation(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        REVOKED = 'REVOKED', 'Revoked'
        EXPIRED = 'EXPIRED', 'Expired'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='invitations')
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=OrganizationMembership.Role.choices, default=OrganizationMembership.Role.MEMBER)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_organization_invitations')
    invited_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='accepted_organization_invitations')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['email', 'status']),
        ]

    def __str__(self):
        return f'Invite {self.email} to {self.organization.name} ({self.get_status_display()})'


class UserProfile(models.Model):
    class Role(models.TextChoices):
        PARTNER = 'PARTNER', 'Partner'
        SENIOR_ASSOCIATE = 'SENIOR_ASSOCIATE', 'Senior Associate'
        ASSOCIATE = 'ASSOCIATE', 'Associate'
        PARALEGAL = 'PARALEGAL', 'Regiemedewerker'
        LEGAL_ASSISTANT = 'LEGAL_ASSISTANT', 'Zorgassistent'
        ADMIN = 'ADMIN', 'Administrator'
        CLIENT = 'CLIENT', 'Cliënt'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    session_revocation_counter = models.PositiveIntegerField(
        default=0,
        help_text='Incremented to invalidate prior sessions after security-sensitive changes.',
    )
    mfa_enabled = models.BooleanField(
        default=False,
        help_text='Whether multi-factor authentication is enabled for this account.',
    )
    mfa_verified_at = models.DateTimeField(null=True, blank=True)
    mfa_enrollment_code_expires_at = models.DateTimeField(null=True, blank=True)
    mfa_enrollment_code_hash = models.CharField(
        max_length=128,
        blank=True,
        default='',
        help_text='Hash of a pending MFA enrollment code; empty when not enrolling.',
    )
    mfa_enrollment_code_sent_at = models.DateTimeField(null=True, blank=True)
    mfa_recovery_code_hashes = models.JSONField(
        default=list,
        help_text='Hashes of issued MFA recovery codes; empty list when none.',
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ASSOCIATE)
    phone = models.CharField(max_length=20, blank=True)
    bar_number = models.CharField(max_length=50, blank=True)
    department = models.CharField(max_length=100, blank=True)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.user.get_full_name() or self.user.username} ({self.get_role_display()})'
