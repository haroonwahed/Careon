from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from contracts.forms import CaseIntakeProcessForm, DocumentForm
from contracts.models import (
    CareCategoryMain,
    CareCategorySubcategory,
    CaseIntakeProcess,
    Client as CareClient,
    Document,
    MunicipalityConfiguration,
    Organization,
    RegionalConfiguration,
    RegionType,
)


User = get_user_model()


class PrivacyMinimizationTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Privacy Org", slug="privacy-org")
        self.user = User.objects.create_user(username="privacy-user", password="testpass123")
        self.municipality = MunicipalityConfiguration.objects.create(
            organization=self.organization,
            municipality_name="Privacygemeente",
            municipality_code="PG001",
            status=MunicipalityConfiguration.Status.ACTIVE,
        )
        self.region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_name="Privacyregio",
            region_code="PR001",
            region_type=RegionType.JEUGDREGIO,
            status=RegionalConfiguration.Status.ACTIVE,
        )
        self.region.served_municipalities.add(self.municipality)
        self.main_category = CareCategoryMain.objects.create(
            code="WONEN_VERBLIJF",
            name="Privacy wonen & verblijf",
            order=1,
            is_active=True,
            visible_in_mvp=True,
        )
        self.subcategory = CareCategorySubcategory.objects.create(
            main_category=self.main_category,
            code="WONEN_VERBLIJF_WOONVOORZIENING",
            name="Privacy woonvoorziening",
            order=1,
            is_active=True,
            visible_in_mvp=True,
        )

    def test_intake_form_rejects_direct_identifiers_in_pseudonymous_fields(self):
        form = CaseIntakeProcessForm(
            data={
                "title": "Casuslabel-001",
                "start_date": date.today().isoformat(),
                "target_completion_date": (date.today() + timedelta(days=7)).isoformat(),
                "care_category_main": str(self.main_category.pk),
                "care_category_sub": str(self.subcategory.pk),
                "gemeente": str(self.municipality.pk),
                "regio": str(self.region.pk),
                "urgency": CaseIntakeProcess.Urgency.MEDIUM,
                "complexity": CaseIntakeProcess.Complexity.ENKELVOUDIG,
                "assessment_summary": "Neem contact op via 06 12345678.",
                "description": "Operationele context.",
            },
            organization=self.organization,
        )

        self.assertFalse(form.is_valid())
        self.assertIn("assessment_summary", form.errors)
        self.assertIn("direct herleidbare persoonsgegevens", form.errors["assessment_summary"][0])

    def test_document_form_blocks_identity_documents_with_direct_identifiers(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title="Casuslabel-002",
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            gemeente=self.municipality,
            regio=self.region,
            care_category_main=self.main_category,
            care_category_sub=self.subcategory,
            workflow_state=CaseIntakeProcess.WorkflowState.MATCHING_READY,
        )
        case = intake.ensure_case_record(created_by=self.user)
        provider = CareClient.objects.create(organization=self.organization, name="Provider Privacy", status="ACTIVE")

        form = DocumentForm(
            data={
                "title": "Operationele notitie",
                "document_type": Document.DocType.OTHER,
                "status": Document.Status.DRAFT,
                "description": "Korte operationele notitie met contactgegevens",
                "contract": str(case.pk),
                "matter": "",
                "client": str(provider.pk),
                "tags": "operationeel, privacy",
                "is_privileged": False,
                "is_confidential": True,
            },
            files={
                "file": SimpleUploadedFile(
                    "casusnotitie.txt",
                    "Client kan bereikt worden via info@example.com en 0612345678.".encode("utf-8"),
                    content_type="text/plain",
                ),
            },
        )

        self.assertFalse(form.is_valid())
        self.assertIn("file", form.errors)
        self.assertNotIn("document_type", form.errors)

    def test_document_form_requires_external_handoff_reference_for_sensitive_types(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title="Casuslabel-003",
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            gemeente=self.municipality,
            regio=self.region,
            care_category_main=self.main_category,
            care_category_sub=self.subcategory,
            workflow_state=CaseIntakeProcess.WorkflowState.MATCHING_READY,
        )
        case = intake.ensure_case_record(created_by=self.user)

        form = DocumentForm(
            data={
                "title": "Externe contractreferentie",
                "document_type": Document.DocType.CONTRACT,
                "status": Document.Status.DRAFT,
                "description": "Alleen een veilige verwijzing",
                "contract": str(case.pk),
                "matter": "",
                "client": "",
                "tags": "extern, contract",
                "is_privileged": True,
                "is_confidential": True,
            }
        )

        self.assertFalse(form.is_valid())
        self.assertIn("external_handoff_reference", form.errors)

    def test_document_form_rejects_files_for_sensitive_types_even_with_reference(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title="Casuslabel-004",
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            gemeente=self.municipality,
            regio=self.region,
            care_category_main=self.main_category,
            care_category_sub=self.subcategory,
            workflow_state=CaseIntakeProcess.WorkflowState.MATCHING_READY,
        )
        case = intake.ensure_case_record(created_by=self.user)

        form = DocumentForm(
            data={
                "title": "Externe overeenkomstreferentie",
                "document_type": Document.DocType.CONTRACT,
                "status": Document.Status.DRAFT,
                "description": "Externe handoff met referentie",
                "external_handoff_reference": "secure-share://case/2026/001",
                "contract": str(case.pk),
                "matter": "",
                "client": "",
                "tags": "extern, contract",
                "is_privileged": True,
                "is_confidential": True,
            },
            files={
                "file": SimpleUploadedFile(
                    "contract.pdf",
                    b"Beperkt document zonder direct identifiers",
                    content_type="application/pdf",
                ),
            },
        )

        self.assertFalse(form.is_valid())
        self.assertIn("file", form.errors)

    def test_document_form_accepts_sensitive_placeholder_without_file(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title="Casuslabel-005",
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            gemeente=self.municipality,
            regio=self.region,
            care_category_main=self.main_category,
            care_category_sub=self.subcategory,
            workflow_state=CaseIntakeProcess.WorkflowState.MATCHING_READY,
        )
        case = intake.ensure_case_record(created_by=self.user)

        form = DocumentForm(
            data={
                "title": "Externe overeenkomstreferentie",
                "document_type": Document.DocType.CONTRACT,
                "status": Document.Status.DRAFT,
                "description": "Alleen een veilige verwijzing",
                "external_handoff_reference": "secure-share://case/2026/001",
                "contract": str(case.pk),
                "matter": "",
                "client": "",
                "tags": "extern, contract",
                "is_privileged": True,
                "is_confidential": True,
            }
        )

        self.assertTrue(form.is_valid(), form.errors.as_json())

    def test_document_form_rejects_image_uploads(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title="Casuslabel-006",
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            gemeente=self.municipality,
            regio=self.region,
            care_category_main=self.main_category,
            care_category_sub=self.subcategory,
            workflow_state=CaseIntakeProcess.WorkflowState.MATCHING_READY,
        )
        case = intake.ensure_case_record(created_by=self.user)

        form = DocumentForm(
            data={
                "title": "Operationele afbeelding",
                "document_type": Document.DocType.OTHER,
                "status": Document.Status.DRAFT,
                "description": "Beeldmateriaal",
                "contract": str(case.pk),
                "matter": "",
                "client": "",
                "tags": "operationeel",
                "is_privileged": False,
                "is_confidential": False,
            },
            files={
                "file": SimpleUploadedFile(
                    "scan.png",
                    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01",
                    content_type="image/png",
                ),
            },
        )

        self.assertFalse(form.is_valid())
        self.assertIn("file", form.errors)
        self.assertIn("Afbeeldingen en scan-PDF's worden niet in CareOn opgeslagen", form.errors["file"][0])

    def test_document_form_rejects_scan_pdfs(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title="Casuslabel-007",
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            gemeente=self.municipality,
            regio=self.region,
            care_category_main=self.main_category,
            care_category_sub=self.subcategory,
            workflow_state=CaseIntakeProcess.WorkflowState.MATCHING_READY,
        )
        case = intake.ensure_case_record(created_by=self.user)

        form = DocumentForm(
            data={
                "title": "Scan PDF",
                "document_type": Document.DocType.OTHER,
                "status": Document.Status.DRAFT,
                "description": "Lege scan",
                "contract": str(case.pk),
                "matter": "",
                "client": "",
                "tags": "scan",
                "is_privileged": False,
                "is_confidential": False,
            },
            files={
                "file": SimpleUploadedFile(
                    "scan.pdf",
                    b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<<>>\nstartxref\n0\n%%EOF",
                    content_type="application/pdf",
                ),
            },
        )

        self.assertFalse(form.is_valid())
        self.assertIn("file", form.errors)
        self.assertIn("Afbeeldingen en scan-PDF's worden niet in CareOn opgeslagen", form.errors["file"][0])
