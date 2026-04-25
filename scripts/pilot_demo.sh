#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings_rehearsal}"

PYTHON_BIN="./.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python"
fi

DEFAULT_E2E_PORT="${E2E_PORT:-8011}"
E2E_PORT="$DEFAULT_E2E_PORT"

if [[ -z "${E2E_BASE_URL:-}" ]]; then
  for candidate in $(seq "$DEFAULT_E2E_PORT" $((DEFAULT_E2E_PORT + 20))); do
    if ! lsof -nP -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; then
      E2E_PORT="$candidate"
      break
    fi
  done
  export E2E_BASE_URL="http://127.0.0.1:${E2E_PORT}"
else
  export E2E_BASE_URL="${E2E_BASE_URL}"
  E2E_PORT="${E2E_BASE_URL##*:}"
fi

export E2E_PASSWORD="${E2E_PASSWORD:-pilot_demo_pass_123}"
export E2E_GEMEENTE_USERNAME="${E2E_GEMEENTE_USERNAME:-demo_gemeente}"
export E2E_PROVIDER_ONE_USERNAME="${E2E_PROVIDER_ONE_USERNAME:-demo_provider_brug}"
export E2E_PROVIDER_TWO_USERNAME="${E2E_PROVIDER_TWO_USERNAME:-demo_provider_kompas}"
export E2E_PROVIDER_ONE_NAME="${E2E_PROVIDER_ONE_NAME:-Jeugdzorg De Brug}"
export E2E_PROVIDER_TWO_NAME="${E2E_PROVIDER_TWO_NAME:-Kompas Jeugdzorg}"
export E2E_MUNICIPALITY_NAME="${E2E_MUNICIPALITY_NAME:-Gemeente Utrecht}"
export E2E_REGION_NAME="${E2E_REGION_NAME:-Regio Utrecht}"
export E2E_DEMO_CASE_TITLE="${E2E_DEMO_CASE_TITLE:-Pilot demo casus: urgente jeugdzorg}"

mkdir -p logs

echo "[pilot-demo] Migrating rehearsal database..."
"$PYTHON_BIN" manage.py migrate --noinput >/dev/null

echo "[pilot-demo] Resetting rehearsal database..."
"$PYTHON_BIN" manage.py flush --noinput >/dev/null

echo "[pilot-demo] Seeding demo actors and provider setup..."
"$PYTHON_BIN" manage.py shell <<'PY'
import os
from django.contrib.auth.models import User
from contracts.models import (
    Client,
    MunicipalityConfiguration,
    Organization,
    OrganizationMembership,
    ProviderProfile,
    RegionalConfiguration,
    UserProfile,
)

password = os.environ["E2E_PASSWORD"]
org, _ = Organization.objects.get_or_create(name="Pilot Demo Org", defaults={"slug": "pilot-demo-org"})
org.slug = "pilot-demo-org"
org.is_active = True
org.save(update_fields=["slug", "is_active", "updated_at"])

def ensure_user(username, email, first_name, last_name, role):
    user, _ = User.objects.get_or_create(username=username, defaults={"email": email})
    user.email = email
    user.first_name = first_name
    user.last_name = last_name
    user.is_active = True
    user.set_password(password)
    user.save()
    OrganizationMembership.objects.update_or_create(
        organization=org,
        user=user,
        defaults={"role": OrganizationMembership.Role.MEMBER, "is_active": True},
    )
    profile, _ = UserProfile.objects.get_or_create(user=user, defaults={"role": role})
    profile.role = role
    profile.save(update_fields=["role"])
    return user

gemeente_user = ensure_user(
    os.environ["E2E_GEMEENTE_USERNAME"],
    "demo.gemeente@example.com",
    "Demo",
    "Gemeente",
    UserProfile.Role.ASSOCIATE,
)
provider_one_user = ensure_user(
    os.environ["E2E_PROVIDER_ONE_USERNAME"],
    "demo.provider.brug@example.com",
    "Jeugdzorg",
    "De Brug",
    UserProfile.Role.CLIENT,
)
provider_two_user = ensure_user(
    os.environ["E2E_PROVIDER_TWO_USERNAME"],
    "demo.provider.kompas@example.com",
    "Kompas",
    "Jeugdzorg",
    UserProfile.Role.CLIENT,
)

municipality, _ = MunicipalityConfiguration.objects.get_or_create(
    organization=org,
    municipality_code="UTR-DEMO",
    defaults={
        "municipality_name": os.environ["E2E_MUNICIPALITY_NAME"],
        "province": "Utrecht",
        "created_by": gemeente_user,
    },
)
municipality.municipality_name = os.environ["E2E_MUNICIPALITY_NAME"]
municipality.status = MunicipalityConfiguration.Status.ACTIVE
municipality.responsible_coordinator = gemeente_user
municipality.save(update_fields=["municipality_name", "status", "responsible_coordinator", "updated_at"])

region, _ = RegionalConfiguration.objects.get_or_create(
    organization=org,
    region_code="REG-DEMO",
    defaults={
        "region_name": os.environ["E2E_REGION_NAME"],
        "region_type": "GEMEENTELIJK",
        "province": "Utrecht",
        "created_by": gemeente_user,
    },
)
region.region_name = os.environ["E2E_REGION_NAME"]
region.region_type = "GEMEENTELIJK"
region.status = RegionalConfiguration.Status.ACTIVE
region.responsible_coordinator = gemeente_user
region.save(update_fields=["region_name", "region_type", "status", "responsible_coordinator", "updated_at"])
region.served_municipalities.set([municipality])

for provider_name, username in [
    (os.environ["E2E_PROVIDER_ONE_NAME"], os.environ["E2E_PROVIDER_ONE_USERNAME"]),
    (os.environ["E2E_PROVIDER_TWO_NAME"], os.environ["E2E_PROVIDER_TWO_USERNAME"]),
]:
    provider_client, _ = Client.objects.get_or_create(
        organization=org,
        name=provider_name,
        defaults={
            "client_type": Client.ClientType.CORPORATION,
            "status": Client.Status.ACTIVE,
            "created_by": gemeente_user,
            "city": "Utrecht",
        },
    )
    provider_client.client_type = Client.ClientType.CORPORATION
    provider_client.status = Client.Status.ACTIVE
    provider_client.created_by = gemeente_user
    provider_client.city = "Utrecht"
    provider_client.save(update_fields=["client_type", "status", "created_by", "city", "updated_at"])

    profile, _ = ProviderProfile.objects.get_or_create(
        client=provider_client,
        defaults={
            "target_age_12_18": True,
            "offers_outpatient": True,
            "handles_simple": True,
            "handles_multiple": True,
            "handles_low_urgency": True,
            "handles_medium_urgency": True,
            "handles_high_urgency": True,
            "current_capacity": 4,
            "max_capacity": 8,
            "waiting_list_length": 1,
            "average_wait_days": 2,
            "service_area": "Utrecht",
            "special_facilities": "Pilot demo capaciteit",
        },
    )
    profile.offers_outpatient = True
    profile.handles_simple = True
    profile.handles_multiple = True
    profile.handles_low_urgency = True
    profile.handles_medium_urgency = True
    profile.handles_high_urgency = True
    profile.current_capacity = 4
    profile.max_capacity = 8
    profile.waiting_list_length = 1
    profile.average_wait_days = 2
    profile.service_area = "Utrecht"
    profile.special_facilities = "Pilot demo capaciteit"
    profile.save()
    profile.served_regions.set([region])

print("seeded pilot demo org", org.slug)
PY

echo "[pilot-demo] Starting temporary Django server at ${E2E_BASE_URL}..."
"$PYTHON_BIN" manage.py runserver "127.0.0.1:${E2E_PORT}" --noreload > logs/pilot-demo-devserver.log 2>&1 &
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
  echo "[pilot-demo] Server did not become ready; check logs/pilot-demo-devserver.log"
  exit 1
fi

echo "[pilot-demo] Running pilot demo Playwright story..."
npm --prefix client exec -- playwright test tests/e2e/pilot-demo.spec.ts --grep "part 1"

echo "[pilot-demo] Normalizing rejected placement for the rematch phase..."
"$PYTHON_BIN" manage.py shell <<'PY'
import os
from contracts.models import CareCase, CaseIntakeProcess, OutcomeReasonCode, PlacementRequest

title = os.environ["E2E_DEMO_CASE_TITLE"]
intake = CaseIntakeProcess.objects.select_related("contract").get(title=title)
placement = (
    PlacementRequest.objects
    .filter(due_diligence_process=intake)
    .order_by("-updated_at")
    .first()
)
if placement is None:
    raise SystemExit("No placement found for pilot demo case")

placement.status = PlacementRequest.Status.IN_REVIEW
placement.provider_response_status = PlacementRequest.ProviderResponseStatus.PENDING
placement.provider_response_reason_code = OutcomeReasonCode.NONE
placement.save(update_fields=["status", "provider_response_status", "provider_response_reason_code", "updated_at"])

intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
intake.save(update_fields=["status", "updated_at"])

if intake.case_record is not None:
    intake.case_record.case_phase = CareCase.CasePhase.MATCHING
    intake.case_record.save(update_fields=["case_phase", "updated_at"])

print("normalized pilot demo case for rematch")
PY

npm --prefix client exec -- playwright test tests/e2e/pilot-demo.spec.ts --grep "part 2"

echo "[pilot-demo] Completed successfully."
