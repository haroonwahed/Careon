# Carelane development tasks
# Usage: make dev | make test | make build | make migrate

VENV := .venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip
DJANGO := $(PYTHON) manage.py

.PHONY: dev setup install migrate seed test test-e2e test-e2e-visual lint typecheck build clean verify

## Start both Django + Vite dev servers concurrently
dev: $(VENV)/bin/activate
	@echo "Starting Django (:8000) and Vite (:3000)..."
	@trap 'kill %1 %2 2>/dev/null; exit' INT; \
	  DJANGO_SECRET_KEY=$${DJANGO_SECRET_KEY:-dev-not-for-production} \
	  $(DJANGO) runserver & \
	  cd client && npm run dev & \
	  wait

## Full first-time setup: create venv, install deps, run migrations
setup: $(VENV)/bin/activate install migrate
	@echo ""
	@echo "Setup complete. Run 'make dev' to start."

$(VENV)/bin/activate:
	python3 -m venv $(VENV)

install: $(VENV)/bin/activate
	$(PIP) install -r requirements/dev.txt
	cd client && npm install

migrate:
	DJANGO_SECRET_KEY=$${DJANGO_SECRET_KEY:-dev-not-for-production} $(DJANGO) migrate

seed:
	DJANGO_SECRET_KEY=$${DJANGO_SECRET_KEY:-dev-not-for-production} $(DJANGO) seed_pilot_universe --reset

## Run the full local verification suite (same gate as CI)
## See scripts/verify.sh for the canonical sequence.
verify:
	@./scripts/verify.sh

## Run Python tests
test:
	$(VENV)/bin/pytest tests/ -q --no-header

## Run Playwright visual regression tests (auto-starts Vite on :3000, no Django needed)
test-e2e:
	cd client && npm run test:e2e:visual

## Run Playwright integration tests (requires Django on :8010 and Vite on :3000)
test-e2e-full:
	cd client && npm run test:e2e

## Run frontend unit tests
test-unit:
	cd client && npm test

## Run all linters
lint:
	$(VENV)/bin/python scripts/terminology_guard.py
	$(VENV)/bin/bandit -r contracts/ -q
	cd client && npm run typecheck

## TypeScript type check only
typecheck:
	cd client && npm run typecheck

## Production build
build:
	cd client && npm run build
	DJANGO_SECRET_KEY=$${DJANGO_SECRET_KEY:-dev-not-for-production} $(DJANGO) collectstatic --noinput

## Install Storybook (run once after cloning)
storybook-setup:
	cd client && npm install --save-dev @storybook/react @storybook/react-vite @storybook/addon-essentials @storybook/addon-a11y storybook

## Launch Storybook component explorer on :6006
storybook:
	cd client && npm run storybook

## Remove build artifacts
clean:
	rm -rf theme/static/spa/ client/dist/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
