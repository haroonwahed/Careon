# CMS Aegis - Legal Practice Management System

## Overview
A production-grade Django-based legal practice management system with comprehensive features for law firm operations.

## Tech Stack
- **Backend**: Django 5.2.5, Python 3.12
- **Database**: SQLite (dev), PostgreSQL-ready
- **Frontend**: Tailwind CSS, Alpine.js
- **Server**: Django dev server on port 5000

## Project Structure
```
config/           - Django settings, URLs, feature flags
contracts/        - Main app: models, views, forms, middleware, URLs
  management/commands/seed_data.py - Database seeder
  migrations/0001_initial.py       - Single consolidated migration
theme/templates/  - All HTML templates
  base.html       - Main layout with sidebar navigation
  base_fullscreen.html - Fullscreen layout (login/register)
  dashboard.html  - Analytics dashboard
  registration/   - Login, register, logout
  contracts/      - All feature templates
media/            - Uploaded files (documents)
```

## Key Features
- **Role-Based Access Control**: Admin, Partner, Senior Associate, Associate, Paralegal, Clerk roles via UserProfile
- **Client Management**: Corporate/Individual clients with responsible/originating attorneys
- **Matter Management**: Practice areas, billing types, budgets, opposing counsel tracking
- **Contract Management**: MSA, NDA, Settlement, Employment and more with versioning
- **Document Management**: File uploads with versioning
- **Time Tracking**: Billable hours by activity type with rate tracking
- **Invoicing**: Draft/Sent/Paid/Overdue with tax support
- **Trust Accounts (IOLTA)**: Deposits, withdrawals, disbursements with balance tracking
- **Conflict of Interest Checks**: Party-based conflict screening
- **Deadline Tracking**: Court filings, regulatory, contract renewals with priority levels
- **Audit Trail**: Middleware-based action logging
- **Notifications**: In-app notification system
- **Reports/Analytics**: Dashboard with KPIs and reporting

## Authentication
- Login: `/login/`
- Register: `/register/`
- Logout: `/logout/`
- Default admin: `admin` / `admin123`
- LOGIN_URL = `/login/`
- LOGIN_REDIRECT_URL = `/dashboard/`

## URL Structure
- `/` - Redirects to dashboard
- `/dashboard/` - Main analytics dashboard
- `/contracts/` - Contract list
- `/contracts/clients/` - Client management
- `/contracts/matters/` - Matter management
- `/contracts/documents/` - Document management
- `/contracts/time/` - Time entries
- `/contracts/invoices/` - Invoicing
- `/contracts/trust-accounts/` - Trust/IOLTA accounts
- `/contracts/deadlines/` - Deadline tracking
- `/contracts/conflicts/` - Conflict checks
- `/contracts/audit-log/` - Audit trail
- `/contracts/notifications/` - Notifications
- `/contracts/reports/` - Reports dashboard
- `/profile/` - User profile

## Running
```bash
python manage.py migrate
python manage.py seed_data   # Creates sample data
python manage.py runserver 0.0.0.0:5000
```

## Workflow
- **Django Server**: `python manage.py runserver 0.0.0.0:5000`
