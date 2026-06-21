# Carelane Observability Checklist

**Purpose:** minimum operational monitoring evidence for production readiness.
**Status:** checklist template until the first monitored release window is completed.

## Application health checks

- [ ] `/_health/` returns `200`
- [ ] app startup logs are clean
- [ ] no boot-time configuration errors
- [ ] release SHA is visible in runtime metadata

## Error logging

- [ ] unhandled exceptions are captured centrally
- [ ] stack traces include request context where available
- [ ] logs do not emit secret values or PII
- [ ] error rate is visible by route and environment

## Audit logging

- [ ] state transitions are append-only
- [ ] actor, action, timestamp, and reason are recorded
- [ ] audit logs are queryable for disputes
- [x] audit log retention policy is documented — default 365 days, configurable via AUDIT_LOG_RETENTION_DAYS; pruned with `python manage.py prune_audit_logs --execute`

## Request / response monitoring

- [ ] request count by route
- [ ] response status class breakdown
- [ ] latency percentiles for core routes
- [ ] elevated 4xx / 5xx alerts
- [ ] slow-request threshold alerts

## Database monitoring

- [ ] connection errors are visible
- [ ] query latency is visible
- [ ] migration failures page the release owner
- [ ] storage / disk pressure is monitored
- [ ] backup age is monitored

## Background jobs

If background jobs are enabled in the deployment:

- [ ] scheduler heartbeat visible
- [ ] last-success timestamp visible
- [ ] job failures alert the owner
- [ ] queue backlog is monitored

If background jobs are not enabled:

- [ ] document that the environment is intentionally job-free

## Frontend error visibility

- [ ] client-side errors are surfaced in monitoring
- [ ] route-level failures can be correlated with request IDs
- [ ] build SHA or release tag is visible in the UI / console metadata

## Alert thresholds

Use the following as starting values unless the hosting provider requires stricter limits:

- [ ] 5xx rate threshold defined
- [ ] p95 latency threshold defined
- [ ] auth failure spike threshold defined
- [ ] DB error spike threshold defined
- [ ] missing health check threshold defined

## Pilot-specific monitoring checklist

- [ ] staging / pilot host listed
- [ ] release captain on watch
- [ ] backend owner on watch
- [ ] ops owner on watch
- [ ] QA owner on watch
- [ ] canonical routes smoke-checked
- [ ] pilot queue / provider queue visible
- [ ] rollback decision path confirmed
- [ ] evidence archived after the watch window

## Evidence

Populate after the first monitored release window.

- Date:
- Environment:
- Dashboard link:
- Alerts configured:
- Incidents observed:
- Owner:
- Notes:

