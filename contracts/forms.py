import re
import shutil
import subprocess
import zipfile
from tempfile import NamedTemporaryFile

from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.core.exceptions import ValidationError
from .models import (
    CareCase, PlacementRequest, CareTask, CareSignal,
    Workflow, WorkflowTemplate, WorkflowTemplateStep, WorkflowStep,
    CaseIntakeProcess, IntakeTask, CaseRiskSignal, Budget, BudgetExpense,
    Client, CareConfiguration, Document, TrustAccount,
    Deadline, UserProfile, CaseAssessment,
    OrganizationInvitation,
    CareCategoryMain,
    CareCategorySubcategory,
    MunicipalityConfiguration, RegionalConfiguration, RegionType,
)
from .region_integrity import is_municipality_mirror_region_data

User = get_user_model()

TAILWIND_INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm'
TAILWIND_SELECT = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white'
TAILWIND_TEXTAREA = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm'
TAILWIND_CHECKBOX = 'h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
TAILWIND_FILE = 'w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'

_PII_PATTERNS = {
    'email': re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+', re.IGNORECASE),
    'phone': re.compile(r'(?<!\d)(?:\+31|0)\s?(?:\d[\s-]?){8,10}(?!\d)'),
    'bsn': re.compile(r'(?<!\d)\d{9}(?!\d)'),
    'postcode': re.compile(r'\b\d{4}\s?[A-Z]{2}\b', re.IGNORECASE),
}
_SENSITIVE_FILENAME_MARKERS = (
    'bsn',
    'burgerservicenummer',
    'paspoort',
    'passport',
    'id-kaart',
    'idkaart',
    'identiteitsbewijs',
    'identification',
    'adres',
    'address',
    'telefoon',
    'phone',
    'email',
    'mail',
    'contact',
)
_IMAGE_FILE_EXTENSIONS = (
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.bmp',
    '.tif',
    '.tiff',
    '.webp',
    '.heic',
    '.heif',
)
_STRICT_EXTERNAL_HANDOFF_TYPES = {
    Document.DocType.CONTRACT,
    Document.DocType.AMENDMENT,
    Document.DocType.CORRESPONDENCE,
}


def _find_direct_identifier(text: str) -> str | None:
    value = (text or '').strip()
    if not value:
        return None
    for label, pattern in _PII_PATTERNS.items():
        if pattern.search(value):
            return label
    return None


def _scan_uploaded_file_for_direct_identifiers(uploaded_file) -> str | None:
    if uploaded_file is None:
        return None

    content_type = (getattr(uploaded_file, 'content_type', '') or '').lower()
    filename = (getattr(uploaded_file, 'name', '') or '').lower()
    file_size = int(getattr(uploaded_file, 'size', 0) or 0)
    max_bytes = min(max(file_size, 0), 512_000) if file_size else 512_000

    def _scan_text(payload: bytes) -> str | None:
        for encoding in ('utf-8', 'utf-16', 'latin1'):
            try:
                decoded = payload.decode(encoding, errors='ignore')
            except Exception:
                continue
            identifier = _find_direct_identifier(decoded)
            if identifier is not None:
                return identifier
        return None

    if content_type.startswith('image/') or filename.endswith(_IMAGE_FILE_EXTENSIONS):
        return 'image'

    if content_type == 'application/pdf' or filename.endswith('.pdf'):
        pdf_text = None
        pdftotext_path = shutil.which('pdftotext')
        if pdftotext_path:
            try:
                uploaded_file.seek(0)
            except Exception:
                pass
            with NamedTemporaryFile(suffix='.pdf', delete=True) as temp_file:
                try:
                    for chunk in iter(lambda: uploaded_file.read(1024 * 1024), b''):
                        temp_file.write(chunk)
                    temp_file.flush()
                    result = subprocess.run(
                        [pdftotext_path, temp_file.name, '-'],
                        capture_output=True,
                        text=True,
                        timeout=10,
                        check=False,
                    )
                    if result.returncode == 0:
                        pdf_text = result.stdout or ''
                except Exception:
                    pdf_text = None
        else:
            return 'scan'
        try:
            uploaded_file.seek(0)
        except Exception:
            pass
        if pdf_text is None:
            return 'scan'
        identifier = _find_direct_identifier(pdf_text)
        if identifier is not None:
            return identifier
        if not pdf_text.strip():
            return 'scan'
        return None

    if filename.endswith(('.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp', '.zip')):
        try:
            with zipfile.ZipFile(uploaded_file) as archive:
                for info in archive.infolist():
                    if info.file_size <= 0 or info.file_size > 512_000:
                        continue
                    if not info.filename.lower().endswith(('.xml', '.txt', '.csv', '.json', '.html', '.htm')):
                        continue
                    with archive.open(info) as handle:
                        identifier = _scan_text(handle.read(512_000))
                        if identifier is not None:
                            return identifier
        except Exception:
            pass
        finally:
            try:
                uploaded_file.seek(0)
            except Exception:
                pass

    try:
        payload = uploaded_file.read(max_bytes)
    except Exception:
        try:
            uploaded_file.seek(0)
            payload = uploaded_file.read(max_bytes)
        except Exception:
            return None
    finally:
        try:
            uploaded_file.seek(0)
        except Exception:
            pass

    identifier = _scan_text(payload or b'')
    if identifier is not None:
        return identifier

    if any(marker in filename for marker in _SENSITIVE_FILENAME_MARKERS):
        return 'filename'

    if content_type.startswith('text/') or content_type in {'application/json', 'application/xml', 'text/xml'}:
        return _scan_text(payload or b'')

    return None


class UserProfileForm(forms.ModelForm):
    first_name = forms.CharField(max_length=30, required=False, widget=forms.TextInput(attrs={'class': TAILWIND_INPUT}))
    last_name = forms.CharField(max_length=30, required=False, widget=forms.TextInput(attrs={'class': TAILWIND_INPUT}))
    email = forms.EmailField(required=False, widget=forms.EmailInput(attrs={'class': TAILWIND_INPUT}))

    class Meta:
        model = UserProfile
        fields = ['role', 'phone', 'department', 'bio']
        widgets = {
            'role': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'phone': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'department': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'bio': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
        }
        labels = {
            'role': 'Rol',
            'phone': 'Telefoon',
            'department': 'Team / afdeling',
            'bio': 'Korte profielnotitie',
        }


class ClientForm(forms.ModelForm):
    served_regions = forms.ModelMultipleChoiceField(
        queryset=RegionalConfiguration.objects.none(),
        required=False,
        widget=forms.SelectMultiple(attrs={'class': TAILWIND_SELECT}),
        label='Bediende regio\'s',
    )

    class Meta:
        model = Client
        fields = ['name', 'client_type', 'status', 'email', 'phone', 'address', 'city',
                  'state', 'zip_code', 'country', 'tax_id', 'website', 'industry',
                  'primary_contact', 'primary_contact_email', 'primary_contact_phone',
                  'responsible_coordinator', 'intake_coordinator', 'served_regions', 'notes']
        widgets = {
            'name': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'client_type': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'status': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'email': forms.EmailInput(attrs={'class': TAILWIND_INPUT}),
            'phone': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'address': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 2}),
            'city': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'state': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'zip_code': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'country': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'tax_id': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'website': forms.URLInput(attrs={'class': TAILWIND_INPUT}),
            'industry': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'primary_contact': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'primary_contact_email': forms.EmailInput(attrs={'class': TAILWIND_INPUT}),
            'primary_contact_phone': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'responsible_coordinator': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'intake_coordinator': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'notes': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
        }
        labels = {
            'name': 'Naam zorgaanbieder',
            'client_type': 'Type aanbieder',
            'status': 'Beschikbaarheidsstatus',
            'industry': 'Specialisatie',
            'responsible_coordinator': 'Casusregisseur',
            'intake_coordinator': 'Backoffice contact',
            'notes': 'Notities en voorwaarden',
            'served_regions': 'Bediende regio\'s',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['served_regions'].queryset = RegionalConfiguration.objects.order_by('region_type', 'region_name')
        profile = getattr(self.instance, 'provider_profile', None)
        if profile:
            self.initial['served_regions'] = profile.served_regions.values_list('id', flat=True)


class CareConfigurationForm(forms.ModelForm):
    class Meta:
        model = CareConfiguration
        fields = [
            'title',
            'scope',
            'is_active',
            'care_domains',
            'linked_providers',
            'max_wait_days',
            'priority_rules',
            'responsible_care_coordinator',
            'responsible_team',
            'intake_creator',
            'open_date',
            'description',
            'notes',
        ]
        widgets = {
            'title': forms.TextInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Bijv. Gemeente Utrecht'}),
            'scope': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'is_active': forms.CheckboxInput(attrs={'class': TAILWIND_CHECKBOX}),
            'care_domains': forms.SelectMultiple(attrs={'class': TAILWIND_SELECT}),
            'linked_providers': forms.SelectMultiple(attrs={'class': TAILWIND_SELECT}),
            'max_wait_days': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'min': '0'}),
            'priority_rules': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
            'responsible_care_coordinator': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'responsible_team': forms.TextInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Bijv. Team Jeugd Noord'}),
            'intake_creator': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'open_date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
            'description': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
            'notes': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
        }
        labels = {
            'title': 'Gemeente / regio naam',
            'scope': 'Type',
            'is_active': 'Actief',
            'care_domains': 'Zorgdomeinen',
            'linked_providers': 'Aanbieders',
            'max_wait_days': 'Max wachttijd (dagen)',
            'priority_rules': 'Prioriteitsregels (optioneel)',
            'responsible_care_coordinator': 'Verantwoordelijke',
            'responsible_team': 'Verantwoordelijk team',
            'intake_creator': 'Back-up verantwoordelijke',
            'open_date': 'Startdatum',
            'description': 'Configuratiebeschrijving',
            'notes': 'Regienotities',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['care_domains'].queryset = CareCategoryMain.objects.filter(is_active=True).order_by('order', 'name')
        self.fields['linked_providers'].queryset = Client.objects.filter(status='ACTIVE').order_by('name')
        self.fields['care_domains'].required = False
        self.fields['linked_providers'].required = False

class DocumentForm(forms.ModelForm):
    class Meta:
        model = Document
        fields = [
            'title',
            'document_type',
            'status',
            'description',
            'external_handoff_reference',
            'file',
            'contract',
            'matter',
            'client',
            'tags',
            'is_privileged',
            'is_confidential',
        ]
        widgets = {
            'title': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'document_type': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'status': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'description': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
            'external_handoff_reference': forms.TextInput(
                attrs={
                    'class': TAILWIND_INPUT,
                    'placeholder': 'Veilige referentie in extern systeem of beveiligde uitwisseling',
                }
            ),
            'file': forms.FileInput(attrs={'class': TAILWIND_FILE}),
            'contract': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'matter': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'client': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'tags': forms.TextInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Tags gescheiden door komma\'s'}),
            'is_privileged': forms.CheckboxInput(attrs={'class': TAILWIND_CHECKBOX}),
            'is_confidential': forms.CheckboxInput(attrs={'class': TAILWIND_CHECKBOX}),
        }
        labels = {
            'title': 'Documenttitel',
            'document_type': 'Documentsoort',
            'status': 'Documentstatus',
            'description': 'Omschrijving',
            'external_handoff_reference': 'Externe handoffreferentie',
            'file': 'Bestand',
            'contract': 'Casus',
            'matter': 'Configuratie',
            'client': 'Aanbieder',
            'tags': 'Tags',
            'is_privileged': 'Beperkte inzage',
            'is_confidential': 'Vertrouwelijk',
        }
        help_texts = {
            'title': 'Gebruik een operationele titel. Geen namen, BSN of contactgegevens.',
            'description': 'Vat de inhoud kort samen zonder direct herleidbare persoonsgegevens.',
            'external_handoff_reference': 'Verplicht voor gevoelige documenttypes. Gebruik alleen een veilige verwijzing, geen persoonsgegevens.',
            'file': 'Upload alleen tekstuele operationele documenten. Afbeeldingen en scan-PDF\'s gaan via externe handoff.',
            'tags': 'Gebruik functionele tags, geen persoonsgegevens.',
        }

    def clean(self):
        cleaned_data = super().clean()
        title = str(cleaned_data.get('title') or '')
        description = str(cleaned_data.get('description') or '')
        tags = str(cleaned_data.get('tags') or '')
        external_handoff_reference = str(cleaned_data.get('external_handoff_reference') or '').strip()
        file_obj = cleaned_data.get('file')
        document_type = cleaned_data.get('document_type')

        for field_name, value in (('title', title), ('description', description), ('tags', tags)):
            if _find_direct_identifier(value) is not None:
                self.add_error(
                    field_name,
                    'Verwijder direct herleidbare persoonsgegevens zoals e-mail, telefoonnummer, BSN of postcode.',
                )

        if document_type in _STRICT_EXTERNAL_HANDOFF_TYPES:
            if file_obj is not None:
                self.add_error(
                    'file',
                    'Voor dit documenttype sla je alleen een externe handoffreferentie op. Het bestand zelf hoort in het externe systeem.',
                )
            if not external_handoff_reference:
                self.add_error(
                    'external_handoff_reference',
                    'Vul een veilige externe verwijzing in voor dit documenttype.',
                )
        elif file_obj is not None:
            identifier = _scan_uploaded_file_for_direct_identifiers(file_obj)
            if identifier in {'image', 'scan'}:
                self.add_error(
                    'file',
                    'Afbeeldingen en scan-PDF\'s worden niet in CareOn opgeslagen. Gebruik een externe beveiligde handoff.',
                )
            elif identifier is not None:
                self.add_error(
                    'file',
                    'Dit bestand lijkt direct herleidbare persoonsgegevens te bevatten. Upload alleen een operationeel document of anonimiseer het bestand eerst.',
                )

        return cleaned_data


class TrustAccountForm(forms.ModelForm):
    class Meta:
        model = TrustAccount
        fields = ['provider', 'region', 'care_type', 'wait_days', 'open_slots', 'waiting_list_size', 'notes']
        widgets = {
            'provider': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'region': forms.TextInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Bijv. Regio Midden'}),
            'care_type': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'wait_days': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'min': '0'}),
            'open_slots': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'min': '0'}),
            'waiting_list_size': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'min': '0'}),
            'notes': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
        }
        labels = {
            'provider': 'Aanbieder',
            'region': 'Regio / gemeente',
            'care_type': 'Zorgtype',
            'wait_days': 'Gemiddelde wachttijd (dagen)',
            'open_slots': 'Beschikbare plekken',
            'waiting_list_size': 'Wachtlijst (aantal)',
            'notes': 'Toelichting',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['provider'].required = True
        self.fields['region'].required = True


class DeadlineForm(forms.ModelForm):
    class Meta:
        model = Deadline
        fields = [
            'due_diligence_process',
            'title',
            'task_type',
            'description',
            'due_date',
            'due_time',
            'priority',
            'assigned_to',
        ]
        widgets = {
            'due_diligence_process': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'title': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'task_type': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'description': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
            'priority': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'due_date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
            'due_time': forms.TimeInput(attrs={'class': TAILWIND_INPUT, 'type': 'time'}),
            'assigned_to': forms.Select(attrs={'class': TAILWIND_SELECT}),
        }
        labels = {
            'due_diligence_process': 'Casus selecteren',
            'title': 'Taak',
            'task_type': 'Taaksoort',
            'description': 'Beschrijving',
            'due_date': 'Streefdatum',
            'due_time': 'Tijd (optioneel)',
            'priority': 'Prioriteit',
            'assigned_to': 'Toegewezen aan',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['due_diligence_process'].required = True
        self.fields['due_time'].required = False


class CaseAssessmentForm(forms.ModelForm):
    """Form for care case assessment (Casusbeoordeling)"""
    
    # Multi-select for care signals
    risk_signals = forms.MultipleChoiceField(
        choices=CaseAssessment.RiskSignal.choices,
        widget=forms.CheckboxSelectMultiple(attrs={'class': 'space-y-2'}),
        required=False,
        label='Signalen'
    )
    
    class Meta:
        model = CaseAssessment
        fields = [
            'due_diligence_process',
            'assessment_status',
            'risk_signals',
            'matching_ready',
            'reason_not_ready',
            'notes',
        ]
        widgets = {
            'due_diligence_process': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'assessment_status': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'matching_ready': forms.CheckboxInput(attrs={'class': 'h-4 w-4 rounded'}),
            'reason_not_ready': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
            'notes': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 4}),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk and self.instance.risk_signals:
            # Convert comma-separated string back to list for multi-select display.
            self.fields['risk_signals'].initial = [
                s.strip() for s in self.instance.risk_signals.split(',')
            ]
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        # Convert list of selected signals to comma-separated storage.
        risk_signals = self.cleaned_data.get('risk_signals', [])
        instance.risk_signals = ','.join(risk_signals) if risk_signals else ''
        if commit:
            instance.save()
        return instance


class CareCaseForm(forms.ModelForm):
    class Meta:
        model = CareCase
        fields = ['title', 'contract_type', 'content', 'status', 'preferred_provider', 'value', 'currency',
                  'risk_level', 'lifecycle_stage',
                  'start_date', 'end_date', 'renewal_date', 'auto_renew', 'notice_period_days',
                  'termination_notice_date', 'client', 'matter']
        widgets = {
            'title': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'contract_type': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'content': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 10}),
            'status': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'preferred_provider': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'value': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'step': '0.01'}),
            'currency': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'risk_level': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'lifecycle_stage': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'start_date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
            'end_date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
            'renewal_date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
            'auto_renew': forms.CheckboxInput(attrs={'class': TAILWIND_CHECKBOX}),
            'notice_period_days': forms.NumberInput(attrs={'class': TAILWIND_INPUT}),
            'termination_notice_date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
            'client': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'matter': forms.Select(attrs={'class': TAILWIND_SELECT}),
        }
        labels = {
            'title': 'Casustitel',
            'contract_type': 'Type zorgvraag',
            'content': 'Intake samenvatting',
            'status': 'Casusstatus',
            'preferred_provider': 'Voorkeursaanbieder',
            'value': 'Complexiteitsscore',
            'risk_level': 'Urgentie',
            'start_date': 'Intakedatum',
            'end_date': 'Doeldatum plaatsing',
            'renewal_date': 'Herbeoordelingsdatum',
            'auto_renew': 'Vervolgtraject verwacht',
            'notice_period_days': 'Escalatietermijn (dagen)',
            'termination_notice_date': 'Afsluitdatum',
            'client': 'Zorgaanbieder',
            'matter': 'Gemeente / regio',
        }


class RegistrationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ('username', 'email', 'first_name', 'last_name')


class OrganizationInvitationForm(forms.ModelForm):
    class Meta:
        model = OrganizationInvitation
        fields = ['email', 'role']
        widgets = {
            'email': forms.EmailInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'naam@organisatie.nl'}),
            'role': forms.Select(attrs={'class': TAILWIND_SELECT}),
        }
        labels = {
            'email': 'E-mailadres',
            'role': 'Organisatierol',
        }

    def clean_email(self):
        return self.cleaned_data['email'].strip().lower()


class CaseIntakeProcessForm(forms.ModelForm):
    source_reference = forms.CharField(required=False, widget=forms.HiddenInput())
    jeugdhulpregio = forms.ModelChoiceField(
        queryset=RegionalConfiguration.objects.none(),
        required=False,
        widget=forms.Select(attrs={'class': TAILWIND_SELECT}),
        label='Jeugdhulpregio',
    )
    placement_pressure_horizon = forms.ChoiceField(
        required=False,
        choices=CaseIntakeProcess.PlacementPressureHorizon.choices,
        widget=forms.Select(attrs={'class': TAILWIND_SELECT}),
        label='Huidige situatie houdbaar tot',
    )
    safety_pressure = forms.BooleanField(
        required=False,
        widget=forms.CheckboxInput(attrs={'class': TAILWIND_CHECKBOX}),
        label='Veiligheidsdruk',
    )
    time_sensitive_arrangement = forms.BooleanField(
        required=False,
        widget=forms.CheckboxInput(attrs={'class': TAILWIND_CHECKBOX}),
        label='Tijdskritisch arrangement',
    )
    escalation_needed = forms.BooleanField(
        required=False,
        widget=forms.CheckboxInput(attrs={'class': TAILWIND_CHECKBOX}),
        label='Escalatie nodig',
    )
    placement_pressure_notes = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
        label='Toelichting plaatsingsdruk',
    )
    has_urgency_declaration = forms.BooleanField(
        required=False,
        widget=forms.CheckboxInput(attrs={'class': TAILWIND_CHECKBOX}),
        label='Client heeft al een urgentieverklaring',
    )
    urgency_document = forms.FileField(
        required=False,
        widget=forms.ClearableFileInput(attrs={'class': TAILWIND_INPUT, 'accept': '.pdf,image/*'}),
        label='Urgentieverklaring',
    )
    urgency_applied = forms.BooleanField(
        required=False,
        widget=forms.CheckboxInput(attrs={'class': TAILWIND_CHECKBOX}),
        label='Urgentie aangevraagd',
    )
    urgency_applied_since = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
        label='Sinds wanneer aangevraagd',
    )

    diagnostiek = forms.MultipleChoiceField(
        choices=[
            ('ADHD', 'ADHD'),
            ('PDD_NOS', 'PDD-NOS'),
            ('AUTISME', 'Autisme'),
            ('DEPRESSIE', 'Depressie'),
        ],
        required=False,
        widget=forms.CheckboxSelectMultiple(attrs={'class': TAILWIND_CHECKBOX}),
        label='Diagnostiek',
    )
    problematiek_types = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'bijv. trauma, autisme, hechting'}),
        label='Problematiektypes (komma-gescheiden)',
    )

    class Meta:
        model = CaseIntakeProcess
        fields = [
            'title',
            'source_reference',
            'start_date',
            'target_completion_date',
            'care_category_main',
            'care_category_sub',
            'placement_pressure_horizon',
            'safety_pressure',
            'time_sensitive_arrangement',
            'escalation_needed',
            'placement_pressure_notes',
            'has_urgency_declaration',
            'urgency_applied',
            'urgency_applied_since',
            'urgency_document',
            'assessment_summary',
            'gemeente',
            'regio',
            'urgency',
            'complexity',
            'zorgvorm_gewenst',
            'preferred_care_form',
            'preferred_region_type',
            'preferred_region',
            'max_toelaatbare_wachttijd_dagen',
            'leeftijd',
            'setting_voorkeur',
            'contra_indicaties',
            'problematiek_types',
            'client_age_category',
            'family_situation',
            'school_work_status',
            'postcode',
            'latitude',
            'longitude',
            'case_coordinator',
            'description',
        ]
        widgets = {
            'title': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'start_date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
            'target_completion_date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
            'care_category_main': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'care_category_sub': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'assessment_summary': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 4}),
            'gemeente': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'regio': forms.HiddenInput(),
            'urgency': forms.HiddenInput(),
            'complexity': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'zorgvorm_gewenst': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'preferred_care_form': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'preferred_region_type': forms.HiddenInput(),
            'preferred_region': forms.HiddenInput(),
            'max_toelaatbare_wachttijd_dagen': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'min': 0}),
            'leeftijd': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'min': 0, 'max': 120}),
            'setting_voorkeur': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'contra_indicaties': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
            'client_age_category': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'family_situation': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'school_work_status': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'postcode': forms.TextInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Bijv. 3511AB'}),
            'latitude': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'step': 'any'}),
            'longitude': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'step': 'any'}),
            'case_coordinator': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'description': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 4}),
        }
        labels = {
            'title': 'Casuslabel',
            'start_date': 'Gewenste startdatum',
            'target_completion_date': 'Uiterste plaatsingsdatum',
            'care_category_main': 'Zorgbehoefte categorie',
            'care_category_sub': 'Specifieke zorgbehoefte',
            'assessment_summary': 'Persoonsbeeld',
            'gemeente': 'Gemeente',
            'regio': 'Jeugdhulpregio (intern)',
            'complexity': 'Complexiteit',
            'placement_pressure_horizon': 'Huidige situatie houdbaar tot',
            'safety_pressure': 'Veiligheidsdruk',
            'time_sensitive_arrangement': 'Tijdskritisch arrangement',
            'escalation_needed': 'Escalatie nodig',
            'placement_pressure_notes': 'Toelichting plaatsingsdruk',
            'urgency': 'Urgentieadvies',
            'zorgvorm_gewenst': 'Gewenste zorgvorm (matching)',
            'preferred_care_form': 'Gewenste zorgvorm',
            'preferred_region_type': 'Voorkeur regiotype',
            'preferred_region': 'Voorkeursregio',
            'max_toelaatbare_wachttijd_dagen': 'Max. toelaatbare wachttijd (dagen)',
            'leeftijd': 'Leeftijd',
            'setting_voorkeur': 'Settingvoorkeur',
            'contra_indicaties': 'Contra-indicaties',
            'client_age_category': 'Leeftijdscategorie cliënt',
            'family_situation': 'Gezinssituatie',
            'school_work_status': 'Dagbesteding',
            'postcode': 'Postcode',
            'latitude': 'Latitude',
            'longitude': 'Longitude',
            'case_coordinator': 'Casusregisseur',
            'description': 'Aanvullende opmerkingen',
        }
        help_texts = {
            'title': 'Gebruik een pseudoniem of operationeel label. Geen naam, initialen of andere identificerende gegevens.',
            'assessment_summary': 'Beschrijf alleen het persoonsbeeld zonder direct herleidbare persoonsgegevens.',
            'placement_pressure_notes': 'Gebruik alleen operationele context. Geen namen, adressen, telefoonnummers, e-mailadressen of BSN.',
            'description': 'Alleen aanvullende operationele context. Geen namen, adressen, telefoonnummers of BSN.',
            'school_work_status': 'Beschrijf de onderwijs- of dagstructuur zonder schoolnaam of persoonsnamen.',
        }

    def __init__(self, *args, organization=None, **kwargs):
        # `organization` scopes municipality / jeugdregio querysets to the requesting tenant
        # (with NULL-org rows kept as a shared/system fallback). Passed by API views
        # that have request context; safe default of None preserves legacy behaviour.
        self._organization = organization
        super().__init__(*args, **kwargs)

        self.fields['care_category_main'].queryset = CareCategoryMain.objects.filter(
            is_active=True,
            visible_in_mvp=True,
        ).order_by('order', 'name')

        self.fields['care_category_sub'].queryset = CareCategorySubcategory.objects.filter(
            is_active=True,
            visible_in_mvp=True,
        ).select_related('main_category').order_by('main_category__order', 'order', 'name')

        jeugdregio_qs = RegionalConfiguration.objects.filter(
            status=RegionalConfiguration.Status.ACTIVE,
            region_type=RegionType.JEUGDREGIO,
        )
        if self._organization is not None:
            jeugdregio_qs = jeugdregio_qs.filter(
                Q(organization=self._organization) | Q(organization__isnull=True)
            )
        jeugdregio_qs = jeugdregio_qs.order_by('region_name')

        # Intake now uses a dedicated jeugdregio selector. Hidden compatibility fields
        # are kept in sync so older payloads and downstream code continue to work.
        selected_region_id = (
            self.data.get('jeugdhulpregio')
            or self.data.get('preferred_region')
            or self.data.get('regio')
            or self.initial.get('jeugdhulpregio')
            or self.initial.get('preferred_region')
            or self.initial.get('regio')
            or ''
        )
        selected_region = None
        if selected_region_id:
            selected_region = jeugdregio_qs.filter(pk=selected_region_id).first()
        if selected_region is None and jeugdregio_qs.exists():
            selected_region = jeugdregio_qs.first()

        selected_region_pk = str(selected_region.pk) if selected_region is not None else ''

        self.fields['jeugdhulpregio'].queryset = jeugdregio_qs
        self.fields['preferred_region'].queryset = jeugdregio_qs
        self.fields['regio'].queryset = jeugdregio_qs
        self.fields['regio'].required = False
        self.fields['preferred_region'].required = False
        self.fields['preferred_region_type'].required = False
        self.fields['preferred_region_type'].initial = RegionType.JEUGDREGIO

        if selected_region_pk:
            self.initial.setdefault('jeugdhulpregio', selected_region_pk)
            self.initial.setdefault('preferred_region', selected_region_pk)
            self.initial.setdefault('regio', selected_region_pk)
            self.initial.setdefault('preferred_region_type', RegionType.JEUGDREGIO)

        self.fields['gemeente'].queryset = MunicipalityConfiguration.objects.filter(
            status=MunicipalityConfiguration.Status.ACTIVE
        ).order_by('municipality_name')
        self.initial['preferred_region_type'] = RegionType.JEUGDREGIO

        # Backfill compatibility fields from the explicit jeugdregio selection.
        if selected_region is not None:
            self.initial['jeugdhulpregio'] = selected_region_pk
            self.initial['preferred_region'] = selected_region_pk
            self.initial['regio'] = selected_region_pk
            self.fields['preferred_region'].initial = selected_region_pk
            self.fields['regio'].initial = selected_region_pk

        if self.instance and isinstance(self.instance.problematiek_types, list):
            self.initial['problematiek_types'] = ', '.join(
                [str(item).strip() for item in self.instance.problematiek_types if str(item).strip()]
            )

    def clean_problematiek_types(self):
        raw = self.cleaned_data.get('problematiek_types', '')
        if not raw:
            return []
        return [part.strip() for part in str(raw).split(',') if part.strip()]

    def clean(self):
        cleaned_data = super().clean()
        for field_name in ('title', 'assessment_summary', 'description', 'other_support_description', 'school_work_status', 'contra_indicaties'):
            value = cleaned_data.get(field_name)
            if not value:
                continue
            identifier = _find_direct_identifier(str(value))
            if identifier is not None:
                self.add_error(
                    field_name,
                    'Gebruik geen direct herleidbare persoonsgegevens zoals e-mail, telefoonnummer, BSN of postcode.',
                )
        placement_pressure_notes = cleaned_data.get('placement_pressure_notes')
        if placement_pressure_notes:
            identifier = _find_direct_identifier(str(placement_pressure_notes))
            if identifier is not None:
                self.add_error(
                    'placement_pressure_notes',
                    'Gebruik geen direct herleidbare persoonsgegevens zoals e-mail, telefoonnummer, BSN of postcode.',
                )

        pressure_assessment = CaseIntakeProcess.derive_placement_pressure(
            horizon=cleaned_data.get('placement_pressure_horizon'),
            target_completion_date=cleaned_data.get('target_completion_date'),
            start_date=cleaned_data.get('start_date'),
            safety_pressure=bool(cleaned_data.get('safety_pressure')),
            time_sensitive_arrangement=bool(cleaned_data.get('time_sensitive_arrangement')),
            escalation_needed=bool(cleaned_data.get('escalation_needed')),
        )
        cleaned_data['urgency'] = pressure_assessment['urgency']

        has_urgency_declaration = bool(cleaned_data.get('has_urgency_declaration'))
        urgency_document = cleaned_data.get('urgency_document')
        if pressure_assessment['urgency'] in {CaseIntakeProcess.Urgency.HIGH, CaseIntakeProcess.Urgency.CRISIS} and has_urgency_declaration and not urgency_document:
            self.add_error('urgency_document', 'Voeg een urgentieverklaring toe bij hoge urgentie.')

        selected_region = (
            cleaned_data.get('jeugdhulpregio')
            or cleaned_data.get('preferred_region')
            or cleaned_data.get('regio')
        )
        if selected_region is not None:
            cleaned_data['jeugdhulpregio'] = selected_region
            cleaned_data['preferred_region'] = selected_region
            cleaned_data['regio'] = selected_region
            cleaned_data['preferred_region_type'] = RegionType.JEUGDREGIO
        elif not self.errors.get('jeugdhulpregio') and self.fields['jeugdhulpregio'].queryset.exists():
            self.add_error('jeugdhulpregio', 'Kies een jeugdhulpregio.')
        return cleaned_data

    def save(self, commit=True):
        instance = super().save(commit=False)
        selected_region = (
            self.cleaned_data.get('jeugdhulpregio')
            or self.cleaned_data.get('preferred_region')
            or self.cleaned_data.get('regio')
        )
        if selected_region is not None:
            instance.preferred_region = selected_region
            instance.regio = selected_region
            instance.preferred_region_type = RegionType.JEUGDREGIO
        if commit:
            instance.save()
            self.save_m2m()
        return instance

    def clean_latitude(self):
        latitude = self.cleaned_data.get('latitude')
        if latitude is None:
            return None
        if latitude < -90 or latitude > 90:
            raise forms.ValidationError('Latitude moet tussen -90 en 90 liggen.')
        return latitude

    def clean_longitude(self):
        longitude = self.cleaned_data.get('longitude')
        if longitude is None:
            return None
        if longitude < -180 or longitude > 180:
            raise forms.ValidationError('Longitude moet tussen -180 en 180 liggen.')
        return longitude


class IntakeTaskForm(forms.ModelForm):
    class Meta:
        model = IntakeTask
        fields = ['title', 'category', 'description', 'assigned_to', 'due_date', 'notes']
        widgets = {
            'title': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'category': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'description': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
            'assigned_to': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'due_date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
            'notes': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
        }


class CaseRiskSignalForm(forms.ModelForm):
    class Meta:
        model = CaseRiskSignal
        fields = ['title', 'category', 'description', 'risk_level', 'likelihood',
                 'impact', 'mitigation_strategy', 'owner', 'target_resolution_date']
        widgets = {
            'title': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'category': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'description': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
            'risk_level': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'likelihood': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'impact': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'mitigation_strategy': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
            'owner': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'target_resolution_date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
        }


class BudgetForm(forms.ModelForm):
    class Meta:
        model = Budget
        fields = [
            'scope_type',
            'scope_name',
            'target_group',
            'care_type',
            'allocated_amount',
            'year',
            'linked_providers',
            'linked_cases',
            'linked_placements',
            'description',
        ]
        widgets = {
            'scope_type': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'scope_name': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'target_group': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'care_type': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'year': forms.NumberInput(attrs={'class': TAILWIND_INPUT}),
            'allocated_amount': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'step': '0.01'}),
            'linked_providers': forms.SelectMultiple(attrs={'class': TAILWIND_SELECT}),
            'linked_cases': forms.SelectMultiple(attrs={'class': TAILWIND_SELECT}),
            'linked_placements': forms.SelectMultiple(attrs={'class': TAILWIND_SELECT}),
            'description': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['linked_providers'].required = False
        self.fields['linked_cases'].required = False
        self.fields['linked_placements'].required = False

        self.fields['linked_providers'].queryset = Client.objects.filter(
            provider_profile__isnull=False,
            status='ACTIVE'
        ).order_by('name')
        self.fields['linked_cases'].queryset = CaseIntakeProcess.objects.order_by('-updated_at')
        self.fields['linked_placements'].queryset = PlacementRequest.objects.order_by('-updated_at')


class BudgetExpenseForm(forms.ModelForm):
    class Meta:
        model = BudgetExpense
        fields = ['description', 'amount', 'category', 'date', 'receipt_url']
        widgets = {
            'description': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'amount': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'step': '0.01'}),
            'category': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
            'receipt_url': forms.URLInput(attrs={'class': TAILWIND_INPUT}),
        }


class WorkflowForm(forms.ModelForm):
    class Meta:
        model = Workflow
        fields = ['title', 'description', 'template', 'contract']
        widgets = {
            'title': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'description': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 4}),
            'template': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'contract': forms.Select(attrs={'class': TAILWIND_SELECT}),
        }
        labels = {
            'title': 'Naam matchingflow',
            'description': 'Toelichting processtap',
            'template': 'Flowtemplate',
            'contract': 'Casus',
        }


class WorkflowTemplateForm(forms.ModelForm):
    class Meta:
        model = WorkflowTemplate
        fields = ['name', 'description', 'category']
        widgets = {
            'name': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'description': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 4}),
            'category': forms.Select(attrs={'class': TAILWIND_SELECT}),
        }
        labels = {
            'name': 'Template naam',
            'description': 'Template beschrijving',
            'category': 'Template categorie',
        }


class PlacementRequestForm(forms.ModelForm):
    """Indicatieformulier voor zorgtoewijzing."""

    class Meta:
        model = PlacementRequest
        fields = [
            'due_diligence_process',
            'proposed_provider',
            'selected_provider',
            'care_form',
            'start_date',
            'duration_weeks',
            'status',
            'decision_notes',
        ]
        widgets = {
            'due_diligence_process': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'proposed_provider': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'selected_provider': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'care_form': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'start_date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
            'duration_weeks': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'min': 1, 'placeholder': 'Bijv. 12'}),
            'status': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'decision_notes': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 4}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['due_diligence_process'].label = 'Casus'
        self.fields['due_diligence_process'].required = True
        self.fields['decision_notes'].label = 'Notities'

        self.fields['proposed_provider'].queryset = Client.objects.filter(
            provider_profile__isnull=False,
            status='ACTIVE'
        ).order_by('name')
        self.fields['selected_provider'].queryset = self.fields['proposed_provider'].queryset

    def save(self, commit=True):
        instance = super().save(commit=False)

        # Keep compatibility storage fields populated while the schema catches up.
        if instance.intake:
            instance.mark_text = instance.mark_text or f'Indicatie {instance.intake.title}'
            instance.description = instance.description or instance.decision_notes or 'Indicatiebesluit'

        if commit:
            instance.save()
        return instance


class CareTaskForm(forms.ModelForm):
    class Meta:
        model = CareTask
        fields = ['title', 'description', 'priority', 'due_date', 'assigned_to', 'case_record', 'configuration']
        widgets = {
            'title': forms.TextInput(attrs={'class': TAILWIND_INPUT}),
            'description': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 4}),
            'priority': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'due_date': forms.DateInput(attrs={'class': TAILWIND_INPUT, 'type': 'date'}),
            'assigned_to': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'case_record': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'configuration': forms.Select(attrs={'class': TAILWIND_SELECT}),
        }
        labels = {
            'title': 'Taaktitel',
            'description': 'Taakomschrijving',
            'priority': 'Prioriteit',
            'due_date': 'Streefdatum',
            'assigned_to': 'Toegewezen aan',
            'case_record': 'Casus',
            'configuration': 'Configuratie',
        }


class CareSignalForm(forms.ModelForm):
    class Meta:
        model = CareSignal
        fields = [
            'due_diligence_process',
            'signal_type',
            'risk_level',
            'status',
            'description',
            'follow_up',
            'assigned_to',
        ]
        widgets = {
            'due_diligence_process': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'signal_type': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'risk_level': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'status': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'description': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 4}),
            'follow_up': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3}),
            'assigned_to': forms.Select(attrs={'class': TAILWIND_SELECT}),
        }
        labels = {
            'due_diligence_process': 'Casus',
            'signal_type': 'Type signaal',
            'risk_level': 'Signaalniveau',
            'status': 'Status',
            'description': 'Beschrijving',
            'follow_up': 'Vervolgactie',
            'assigned_to': 'Toegewezen aan',
        }


# ============================================
# MUNICIPALITY & REGIONAL CONFIGURATION FORMS
# ============================================

class MunicipalityConfigurationForm(forms.ModelForm):
    class Meta:
        model = MunicipalityConfiguration
        fields = [
            'municipality_name', 'municipality_code', 'brp_code', 'status',
            'care_domains', 'linked_providers',
            'max_wait_days', 'priority_rules', 'urgency_document_request_url',
            'responsible_coordinator', 'woonplaatsbeginsel_contact', 'budget_owner', 'contract_policies', 'notes'
        ]
        widgets = {
            'municipality_name': forms.TextInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Bijv. Amsterdam'}),
            'municipality_code': forms.TextInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Bijv. 0363'}),
            'brp_code': forms.TextInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Bijv. 0363'}),
            'status': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'care_domains': forms.CheckboxSelectMultiple(attrs={'class': 'h-4 w-4'}),
            'linked_providers': forms.CheckboxSelectMultiple(attrs={'class': 'h-4 w-4'}),
            'max_wait_days': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Bijv. 14'}),
            'priority_rules': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 4, 'placeholder': 'Prioriteringsregels...'}),
            'urgency_document_request_url': forms.URLInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'https://...'}),
            'responsible_coordinator': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'woonplaatsbeginsel_contact': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'budget_owner': forms.TextInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Bijv. Sociaal domein'}),
            'contract_policies': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3, 'placeholder': 'JSON of beleidstekst'}),
            'notes': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3, 'placeholder': 'Aanvullende notities...'}),
        }
        labels = {
            'municipality_name': 'Gemeente',
            'municipality_code': 'Gemeentecode',
            'brp_code': 'BRP-code',
            'status': 'Status',
            'care_domains': 'Zorgdomeinen',
            'linked_providers': 'Gekoppelde aanbieders',
            'max_wait_days': 'Maximale wachttijd (dagen)',
            'priority_rules': 'Prioriteringsregels',
            'urgency_document_request_url': 'Link urgentieverklaring aanvragen',
            'responsible_coordinator': 'Verantwoordelijke',
            'woonplaatsbeginsel_contact': 'Woonplaatsbeginsel contact',
            'budget_owner': 'Budgetverantwoordelijke',
            'contract_policies': 'Contractpolicies',
            'notes': 'Notities',
        }


class RegionalConfigurationForm(forms.ModelForm):
    class Meta:
        model = RegionalConfiguration
        fields = [
            'region_type', 'region_name', 'region_code', 'status',
            'served_municipalities', 'care_domains', 'linked_providers',
            'max_wait_days', 'priority_rules',
            'responsible_coordinator', 'escalatie_contact', 'notes'
        ]
        widgets = {
            'region_type': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'region_name': forms.TextInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Bijv. Netwerk Acute Zorg Midden-Nederland'}),
            'region_code': forms.TextInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Bijv. ZR001'}),
            'status': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'served_municipalities': forms.CheckboxSelectMultiple(attrs={'class': 'h-4 w-4'}),
            'care_domains': forms.CheckboxSelectMultiple(attrs={'class': 'h-4 w-4'}),
            'linked_providers': forms.CheckboxSelectMultiple(attrs={'class': 'h-4 w-4'}),
            'max_wait_days': forms.NumberInput(attrs={'class': TAILWIND_INPUT, 'placeholder': 'Bijv. 14'}),
            'priority_rules': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 4, 'placeholder': 'Prioriteringsregels...'}),
            'responsible_coordinator': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'escalatie_contact': forms.Select(attrs={'class': TAILWIND_SELECT}),
            'notes': forms.Textarea(attrs={'class': TAILWIND_TEXTAREA, 'rows': 3, 'placeholder': 'Aanvullende notities...'}),
        }
        labels = {
            'region_type': 'Regiotype',
            'region_name': 'Zorgregio',
            'region_code': 'Zorgregio code',
            'status': 'Status',
            'served_municipalities': 'Bediende gemeenten',
            'care_domains': 'Zorgdomeinen',
            'linked_providers': 'Gekoppelde aanbieders',
            'max_wait_days': 'Maximale wachttijd (dagen)',
            'priority_rules': 'Prioriteringsregels',
            'responsible_coordinator': 'Verantwoordelijke',
            'escalatie_contact': 'Escalatiecontact',
            'notes': 'Notities',
        }

    def clean(self):
        cleaned_data = super().clean()
        if is_municipality_mirror_region_data(
            region_type=cleaned_data.get('region_type', ''),
            region_name=cleaned_data.get('region_name', ''),
            region_code=cleaned_data.get('region_code', ''),
            served_municipalities=cleaned_data.get('served_municipalities') or [],
        ):
            raise ValidationError(
                'Een gemeentelijke spiegelregio met exact dezelfde naam/code als één gemeente is niet toegestaan. '
                'Koppel gemeenten alleen aan een echte JEUGDREGIO of een apart operationeel gebied.',
            )
        return cleaned_data


# Deprecated aliases removed: concrete form classes above are authoritative.
