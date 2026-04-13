# Interrupted Chat Scan

Generated: Mon Apr 13 13:55:09 CEST 2026

## Recent Sessions (by mtime)
- e395c2ea-3953-457c-bc47-f23722f82abc: interruptions=15, apply_patch_calls=5
- 5ac0cd3c-4e1b-4a5d-a9db-50afd469fe7d: interruptions=3, apply_patch_calls=11
- 638de08b-1153-45ac-af29-3e0b1cb7c581: interruptions=11, apply_patch_calls=14
- 74e80323-cc00-42cb-86f0-ed7a4809fc63: interruptions=4, apply_patch_calls=1
- 32fa09b8-90d4-49a7-80cf-075b4902cedb: interruptions=5, apply_patch_calls=0
- 210d2d15-ccac-42d6-ac27-4b0526bed8c2: interruptions=0, apply_patch_calls=0
- f320d86b-8c7d-4f7a-8a1a-cdbcecdf187a: interruptions=0, apply_patch_calls=18

## Recovery Actions Taken
- Created full workspace recovery patch:
  - logs/recovery/recovered-interrupted-chats-20260413-135500.patch
- Prior checkpoint commit already exists for earlier recovered session:
  - ff5c30a checkpoint: preserve recovered edits after 413 failures

## Current Working Tree Snapshot
 M .github/copilot-instructions.md
 M .vscode/settings.json
 M contracts/forms.py
 M contracts/views.py
 M db.sqlite3
 M scripts/dev_up.sh
 M tests/test_ui_click_integrity.py
 M theme/templates/base.html
 M theme/templates/base_redesign.html
 M theme/templates/contracts/assessment_detail.html
 M theme/templates/contracts/audit_log_list.html
 M theme/templates/contracts/budget_detail.html
 M theme/templates/contracts/budget_form.html
 M theme/templates/contracts/budget_list.html
 M theme/templates/contracts/client_detail.html
 M theme/templates/contracts/client_form.html
 M theme/templates/contracts/deadline_form.html
 M theme/templates/contracts/deadline_list.html
 M theme/templates/contracts/document_detail.html
 M theme/templates/contracts/document_form.html
 M theme/templates/contracts/expense_form.html
 M theme/templates/contracts/intake_list.html
 D theme/templates/contracts/matter_detail.html
 D theme/templates/contracts/matter_form.html
 D theme/templates/contracts/matter_list.html
 M theme/templates/contracts/municipality_detail.html
 M theme/templates/contracts/municipality_form.html
 M theme/templates/contracts/notification_list.html
 M theme/templates/contracts/organization_activity.html
 M theme/templates/contracts/organization_team.html
 M theme/templates/contracts/placement_detail.html
 M theme/templates/contracts/placement_form.html
 M theme/templates/contracts/placement_list.html
 M theme/templates/contracts/regional_detail.html
 M theme/templates/contracts/regional_form.html
 M theme/templates/contracts/search_results.html
 M theme/templates/contracts/signal_detail.html
 M theme/templates/contracts/signal_form.html
 M theme/templates/contracts/task_form.html
 M theme/templates/contracts/waittime_form.html
 M theme/templates/dashboard.html
 M theme/templates/profile.html
 M theme/templates/settings_hub.html
?? .github/prompts/
?? docs/COPILOT_EXECUTION_CONTRACT.md
?? logs/recovery/interrupted-chat-scan-20260413.md
?? logs/recovery/recovered-interrupted-chats-20260413-135500.patch
?? logs/ui-parity/
?? scripts/dev_refresh_and_verify.sh
?? theme/static/css/zorgregie-design-system.css
?? theme/templates/contracts/configuration_detail.html
?? theme/templates/contracts/configuration_form.html
