#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="./.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python"
fi

DEFAULT_E2E_PORT="${E2E_PORT:-8010}"
E2E_PORT="$DEFAULT_E2E_PORT"
E2E_RUN_SUFFIX="${E2E_RUN_SUFFIX:-$(date +%s)}"
E2E_ACCEPT_CASE_TITLE="E2E Pilot Accept Path ${E2E_RUN_SUFFIX}"
E2E_REJECT_CASE_TITLE="E2E Pilot Reject Path ${E2E_RUN_SUFFIX}"

if [[ -z "${E2E_BASE_URL:-}" ]]; then
  for candidate in $(seq "$DEFAULT_E2E_PORT" $((DEFAULT_E2E_PORT + 20))); do
    if ! lsof -nP -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; then
      E2E_PORT="$candidate"
      break
    fi
  done
  E2E_BASE_URL="http://127.0.0.1:${E2E_PORT}"
else
E2E_BASE_URL="${E2E_BASE_URL}"
E2E_PORT="${E2E_BASE_URL##*:}"
fi
E2E_USERNAME="${E2E_USERNAME:-e2e_owner}"
E2E_PASSWORD="${E2E_PASSWORD:-e2e_pass_123}"
E2E_PROVIDER_NAME="${E2E_PROVIDER_NAME:-E2E Provider}"

mkdir -p logs

echo "[verify-ui] Running UI integrity suites..."
"$PYTHON_BIN" manage.py test \
  tests.test_redesign_layout \
  tests.test_dashboard_shell \
  tests.test_reports_dashboard \
  tests.test_ui_click_integrity \
  tests.test_redesign_components \
  -v 2

echo "[verify-ui] Installing Playwright dependencies (if needed)..."
npm --prefix client install >/dev/null
npm --prefix client exec playwright install chromium >/dev/null

echo "[verify-ui] Seeding E2E user and organization..."
"$PYTHON_BIN" manage.py shell -c "
from datetime import timedelta
from django.contrib.auth.models import User
from django.utils import timezone
from contracts.models import (
    AanbiederVestiging,
    Client,
    CaseIntakeProcess,
    MunicipalityConfiguration,
    Organization,
    OrganizationMembership,
    ProviderProfile,
    RegionalConfiguration,
    Zorgaanbieder,
)

username='${E2E_USERNAME}'
password='${E2E_PASSWORD}'
email=f'{username}@example.com'
accept_title='${E2E_ACCEPT_CASE_TITLE}'
reject_title='${E2E_REJECT_CASE_TITLE}'
provider_name='${E2E_PROVIDER_NAME}'

user, _ = User.objects.get_or_create(username=username, defaults={'email': email})
user.email = email
user.set_password(password)
user.is_active = True
user.save()

org, _ = Organization.objects.get_or_create(name='E2E Org', defaults={'slug': 'e2e-org'})
OrganizationMembership.objects.update_or_create(
    organization=org,
    user=user,
    defaults={'role': OrganizationMembership.Role.OWNER, 'is_active': True},
)

municipality, _ = MunicipalityConfiguration.objects.get_or_create(
    organization=org,
    municipality_code='E2E-UTR',
    defaults={
        'municipality_name': 'E2E Gemeente',
        'province': 'Utrecht',
    },
)
region, _ = RegionalConfiguration.objects.get_or_create(
    organization=org,
    region_code='E2E-UTR',
    defaults={
        'region_name': 'E2E Regio Utrecht',
        'region_type': 'GEMEENTELIJK',
        'province': 'Utrecht',
    },
)
if not region.served_municipalities.filter(pk=municipality.pk).exists():
    region.served_municipalities.add(municipality)

provider_client, _ = Client.objects.get_or_create(
    organization=org,
    name=provider_name,
    defaults={
        'client_type': Client.ClientType.CORPORATION,
        'status': Client.Status.ACTIVE,
        'created_by': user,
        'city': 'Utrecht',
    },
)
provider_client.client_type = Client.ClientType.CORPORATION
provider_client.status = Client.Status.ACTIVE
provider_client.created_by = provider_client.created_by or user
provider_client.city = 'Utrecht'
provider_client.save(update_fields=['client_type', 'status', 'created_by', 'city', 'updated_at'])

zorgaanbieder, _ = Zorgaanbieder.objects.get_or_create(
    name=provider_name,
    defaults={'is_active': True},
)
zorgaanbieder.is_active = True
zorgaanbieder.save(update_fields=['is_active'])

provider_profile, _ = ProviderProfile.objects.get_or_create(
    client=provider_client,
    defaults={
        'target_age_12_18': True,
        'offers_outpatient': True,
        'handles_simple': True,
        'handles_multiple': True,
        'handles_low_urgency': True,
        'handles_medium_urgency': True,
        'handles_high_urgency': True,
        'current_capacity': 4,
        'max_capacity': 8,
        'waiting_list_length': 1,
        'average_wait_days': 2,
        'service_area': 'Utrecht',
        'special_facilities': 'Pilot-smoke capaciteit',
    },
)
provider_profile.offers_outpatient = True
provider_profile.handles_simple = True
provider_profile.handles_multiple = True
provider_profile.handles_low_urgency = True
provider_profile.handles_medium_urgency = True
provider_profile.handles_high_urgency = True
provider_profile.current_capacity = 4
provider_profile.max_capacity = 8
provider_profile.waiting_list_length = 1
provider_profile.average_wait_days = 2
provider_profile.service_area = 'Utrecht'
provider_profile.special_facilities = 'Pilot-smoke capaciteit'
provider_profile.save()
provider_profile.served_regions.add(region)

today = timezone.localdate()
case_defaults = dict(
    organization=org,
    status=CaseIntakeProcess.ProcessStatus.INTAKE,
    urgency=CaseIntakeProcess.Urgency.MEDIUM,
    preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
    zorgvorm_gewenst=CaseIntakeProcess.CareForm.OUTPATIENT,
    preferred_region=region,
    preferred_region_type='GEMEENTELIJK',
    gemeente=municipality,
    start_date=today,
    target_completion_date=today + timedelta(days=14),
    case_coordinator=user,
)

for title in [accept_title, reject_title]:
    intake, _ = CaseIntakeProcess.objects.get_or_create(title=title, defaults=case_defaults)
    intake.organization = org
    intake.status = CaseIntakeProcess.ProcessStatus.INTAKE
    intake.urgency = CaseIntakeProcess.Urgency.MEDIUM
    intake.preferred_care_form = CaseIntakeProcess.CareForm.OUTPATIENT
    intake.zorgvorm_gewenst = CaseIntakeProcess.CareForm.OUTPATIENT
    intake.preferred_region = region
    intake.preferred_region_type = 'GEMEENTELIJK'
    intake.gemeente = municipality
    intake.start_date = today
    intake.target_completion_date = today + timedelta(days=14)
    intake.case_coordinator = user
    intake.save()
    intake.ensure_case_record(created_by=user)

print('seeded', username)
"

echo "[verify-ui] Starting temporary Django server at ${E2E_BASE_URL}..."
"$PYTHON_BIN" manage.py runserver "127.0.0.1:${E2E_PORT}" --noreload > logs/e2e-devserver.log 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

for _ in {1..30}; do
  if curl -s -o /dev/null "${E2E_BASE_URL}/login/"; then
    break
  fi
  sleep 1
done

if ! curl -s -o /dev/null "${E2E_BASE_URL}/login/"; then
  echo "[verify-ui] Server did not become ready; check logs/e2e-devserver.log"
  exit 1
fi

echo "[verify-ui] Running Playwright smoke tests..."
E2E_BASE_URL="${E2E_BASE_URL}" \
E2E_USERNAME="${E2E_USERNAME}" \
E2E_PASSWORD="${E2E_PASSWORD}" \
E2E_ACCEPT_CASE_TITLE="${E2E_ACCEPT_CASE_TITLE}" \
E2E_REJECT_CASE_TITLE="${E2E_REJECT_CASE_TITLE}" \
E2E_PROVIDER_NAME="${E2E_PROVIDER_NAME}" \
npm --prefix client run test:e2e

echo "[verify-ui] Completed successfully."
